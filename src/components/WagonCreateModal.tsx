"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Stepper,
  Text,
  TextInput,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBuildingFactory2,
  IconPencil,
  IconRotate,
  IconX,
} from "@tabler/icons-react";
import { apiFetch, showError } from "@/lib/client";
import { useI18n } from "./I18nProvider";
import { pickName, type Lang } from "@/lib/i18n/translations";
import { wagonSchedule, formatDate } from "@/lib/format";
import { OrderedUserPicker } from "./OrderedUserPicker";

interface StageRow {
  id: string;
  number: number;
  nameRu: string;
  nameUz: string | null;
  durationSeconds: number;
  works: { seh: string | null }[];
}

interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  seh: string | null;
  role: { nameRu: string; nameUz: string | null };
}

interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
  types: { value: string; label: string }[];
}

// Ключ группы «цех не указан»: у позиции нет ни одной работы с цехом.
const NO_SEH = "";

/**
 * Цеха позиции — из её работ. В бумажном плане цех указан у КАЖДОЙ работы,
 * и у одной позиции их бывает несколько (кровля — 15-цех, обшивка — 2-цех).
 * Поэтому позиция попадает сразу во все свои группы, а ответственных получает
 * от каждой: подписывают оба мастера.
 */
function stageSehs(works: { seh: string | null }[]): string[] {
  const set = new Set<string>();
  for (const w of works) {
    const s = (w.seh ?? "").trim();
    if (s) set.add(s);
  }
  return [...set];
}

// «2» раньше «15»: как строки они сортируются наоборот.
function compareSeh(a: string, b: string): number {
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b);
}

// «Мастер · 2-цех (Каримов К.)» — роль и цех важнее фамилии: однофамильцев
// различают по роли, а выбирают вообще по цеху.
function userLabel(u: UserRow, lang: Lang, sehWord: string): string {
  const role = pickName(u.role, lang);
  const withSeh = u.seh ? `${role} · ${u.seh}-${sehWord}` : role;
  const name = [u.lastName, u.firstName?.[0] && `${u.firstName[0]}.`]
    .filter(Boolean)
    .join(" ");
  return `${withSeh} (${name})`;
}

// В «таблетке» фамилия не помещается — оставляем роль и цех.
function userShort(u: UserRow, lang: Lang, sehWord: string): string {
  const role = pickName(u.role, lang);
  return u.seh ? `${role} · ${u.seh}-${sehWord}` : role;
}

function initials(u: UserRow): string {
  return ((u.lastName?.[0] ?? "") + (u.firstName?.[0] ?? "")).toUpperCase();
}

/** Ответственные одной группы/позиции — «таблетками» с крестиком. */
function UserPills({
  ids,
  users,
  lang,
  sehWord,
  onRemove,
}: {
  ids: string[];
  users: Map<string, UserRow>;
  lang: Lang;
  sehWord: string;
  onRemove?: (id: string) => void;
}) {
  return (
    <Group gap={6}>
      {ids.map((id) => {
        const u = users.get(id);
        if (!u) return null;
        return (
          <Group
            key={id}
            gap={6}
            wrap="nowrap"
            style={{
              background: "var(--mantine-color-steel-light)",
              borderRadius: 999,
              padding: onRemove ? "3px 4px 3px 3px" : "3px 10px 3px 3px",
            }}
          >
            <Avatar size={22} radius="xl" color="steel" variant="filled">
              <Text size="10px" fw={700}>
                {initials(u)}
              </Text>
            </Avatar>
            <Text size="xs" fw={500} c="steel.8">
              {userShort(u, lang, sehWord)}
            </Text>
            {onRemove && (
              <ActionIcon
                size={18}
                variant="subtle"
                color="steel"
                aria-label="×"
                onClick={() => onRemove(id)}
              >
                <IconX size={12} />
              </ActionIcon>
            )}
          </Group>
        );
      })}
    </Group>
  );
}

export function WagonCreateModal({ opened, onClose, onCreated, types }: Props) {
  const { t, lang } = useI18n();
  // на телефоне окно во весь экран: длинную форму иначе не пролистать
  const isMobile = useMediaQuery("(max-width: 48em)");
  const sehWord = t("wd.sehWord");

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── шаг 1: вагон ──
  const [nameUz, setNameUz] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [number, setNumber] = useState("");
  const [typeId, setTypeId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [stages, setStages] = useState<StageRow[]>([]);
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [creationApproverIds, setCreationApproverIds] = useState<string[]>([]);

  // ── шаг 2: ответственные ──
  const [tab, setTab] = useState<string>("seh");
  const [commonIds, setCommonIds] = useState<string[]>([]);
  // цех → ответственные за все его позиции
  const [sehUsers, setSehUsers] = useState<Record<string, string[]>>({});
  // позиция → список, выставленный руками (перебивает расчёт по цехам)
  const [overrides, setOverrides] = useState<Record<string, string[]>>({});
  const [editing, setEditing] = useState<string | null>(null);

  // Справочники грузим только при открытии окна: на списке вагонов они не нужны,
  // а на телефоне лишний запрос — это лишняя секунда.
  useEffect(() => {
    if (!opened) return;
    let alive = true;

    setStep(0);
    setTab("seh");
    setNameUz("");
    setNameRu("");
    setNumber("");
    setTypeId(null);
    setStartDate(new Date().toISOString().slice(0, 10));
    setCreationApproverIds([]);
    setCommonIds([]);
    setSehUsers({});
    setOverrides({});
    setEditing(null);
    setLoading(true);

    (async () => {
      try {
        const [st, us] = await Promise.all([
          apiFetch<{ stages: StageRow[] }>("/api/stages"),
          apiFetch<{ users: UserRow[] }>("/api/options/users"),
        ]);
        if (!alive) return;
        setStages(st.stages);
        setStageIds(st.stages.map((s) => s.id)); // по умолчанию все
        setUsers(us.users);
      } catch (e) {
        if (alive) showError(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [opened]);

  const userMap = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users]
  );
  const userOptions = useMemo(
    () =>
      users.map((u) => ({ value: u.id, label: userLabel(u, lang, sehWord) })),
    [users, lang, sehWord]
  );

  const stageOptions = useMemo(
    () =>
      stages.map((s) => ({
        value: s.id,
        label: `№${s.number} — ${pickName(s, lang)}`,
      })),
    [stages, lang]
  );

  const selectedStages = useMemo(() => {
    const picked = new Set(stageIds);
    return stages.filter((s) => picked.has(s.id));
  }, [stages, stageIds]);

  // Позиции, сгруппированные по цехам: вместо 27 выборов — 4–6.
  const sehGroups = useMemo(() => {
    const map = new Map<string, StageRow[]>();
    for (const s of selectedStages) {
      const keys = stageSehs(s.works);
      for (const k of keys.length ? keys : [NO_SEH]) {
        const arr = map.get(k);
        if (arr) arr.push(s);
        else map.set(k, [s]);
      }
    }
    return [...map.entries()]
      .sort((a, b) =>
        a[0] === NO_SEH ? 1 : b[0] === NO_SEH ? -1 : compareSeh(a[0], b[0])
      )
      .map(([seh, list]) => ({ seh, stages: list }));
  }, [selectedStages]);

  // Подставляем мастера цеха: у сотрудника цех уже записан в карточке.
  // Трогаем только те группы, которых ещё не было — чужой выбор не затираем.
  useEffect(() => {
    if (!sehGroups.length || !users.length) return;
    setSehUsers((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const g of sehGroups) {
        if (next[g.seh] !== undefined) continue;
        next[g.seh] =
          g.seh === NO_SEH
            ? []
            : users
                .filter((u) => (u.seh ?? "").trim() === g.seh)
                .map((u) => u.id);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [sehGroups, users]);

  // Итог: у каждой позиции свой список — сначала мастера её цехов
  // (они принимают работу), потом те, кто участвует во всех позициях.
  const resolved = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of selectedStages) {
      const manual = overrides[s.id];
      if (manual) {
        map.set(s.id, manual);
        continue;
      }
      const ids: string[] = [];
      const keys = stageSehs(s.works);
      for (const k of keys.length ? keys : [NO_SEH]) {
        for (const id of sehUsers[k] ?? []) if (!ids.includes(id)) ids.push(id);
      }
      for (const id of commonIds) if (!ids.includes(id)) ids.push(id);
      map.set(s.id, ids);
    }
    return map;
  }, [selectedStages, overrides, sehUsers, commonIds]);

  const missing = useMemo(
    () => selectedStages.filter((s) => !resolved.get(s.id)?.length),
    [selectedStages, resolved]
  );

  const setSehValue = useCallback((seh: string, ids: string[]) => {
    setSehUsers((p) => ({ ...p, [seh]: ids }));
  }, []);

  const setStageValue = useCallback((stageId: string, ids: string[]) => {
    setOverrides((p) => ({ ...p, [stageId]: ids }));
  }, []);

  const resetStage = useCallback((stageId: string) => {
    setOverrides((p) => {
      const next = { ...p };
      delete next[stageId];
      return next;
    });
  }, []);

  const deadline = useMemo(() => {
    if (!startDate || selectedStages.length === 0) return null;
    return wagonSchedule(
      startDate,
      selectedStages.map((s) => s.durationSeconds)
    ).end;
  }, [startDate, selectedStages]);

  function goNext() {
    if (!nameUz.trim() || !number.trim() || !typeId) {
      notifications.show({ color: "red", message: t("wagons.fillAll") });
      return;
    }
    if (stageIds.length === 0) {
      notifications.show({ color: "red", message: t("wagons.pickStage") });
      return;
    }
    if (creationApproverIds.length === 0) {
      notifications.show({ color: "red", message: t("wagons.pickApprovers") });
      return;
    }
    setStep(1);
  }

  async function save() {
    if (missing.length > 0) {
      notifications.show({
        color: "red",
        message: t("wagons.pickUsers", {
          list: missing
            .slice(0, 5)
            .map((s) => `№${s.number}`)
            .join(", "),
        }),
      });
      setTab("stage");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/wagons", {
        method: "POST",
        body: JSON.stringify({
          nameUz: nameUz.trim(),
          nameRu: nameRu.trim() || null,
          number: number.trim(),
          wagonTypeId: typeId,
          plannedStart: startDate || null,
          stageIds,
          stageUsers: selectedStages.map((s) => ({
            stageId: s.id,
            userIds: resolved.get(s.id) ?? [],
          })),
          creationApproverIds,
        }),
      });
      notifications.show({
        color: "teal",
        message: t("wagons.created", { n: stageIds.length }),
      });
      onClose();
      onCreated();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  }

  // Кнопки прилипают к низу окна: на телефоне форма во весь экран и длинная —
  // иначе до «Создать» надо докручивать. Отрицательные поля — чтобы полоса
  // шла от края до края поверх отступов тела модалки.
  const footerStyle: React.CSSProperties = {
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    background: "var(--mantine-color-body)",
    borderTop: "1px solid var(--mantine-color-gray-2)",
    marginTop: "var(--mantine-spacing-lg)",
    marginLeft: "calc(var(--mantine-spacing-md) * -1)",
    marginRight: "calc(var(--mantine-spacing-md) * -1)",
    marginBottom: "calc(var(--mantine-spacing-md) * -1)",
    padding: "var(--mantine-spacing-sm) var(--mantine-spacing-md)",
    // в установленном приложении внизу системная полоса «домой»
    paddingBottom:
      "calc(var(--mantine-spacing-sm) + env(safe-area-inset-bottom, 0px))",
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("wagons.modalNew")}
      fullScreen={isMobile}
      size="md"
    >
      {loading ? (
        <Center py={60}>
          <Loader />
        </Center>
      ) : (
        <>
          <Stepper
            active={step}
            onStepClick={setStep}
            size="sm"
            iconSize={30}
            allowNextStepsSelect={false}
          >
            {/* ─────────── Шаг 1: вагон ─────────── */}
            <Stepper.Step label={t("wagons.stepWagon")}>
              <Stack mt="md">
                <TextInput
                  label={`${t("wagons.name")} (${t("field.uz")})`}
                  placeholder="Masalan: Xopper-don tashuvchi"
                  withAsterisk
                  value={nameUz}
                  onChange={(e) => setNameUz(e.currentTarget.value)}
                />
                <TextInput
                  label={`${t("wagons.name")} (${t("field.ru")})`}
                  placeholder={t("wagons.namePlaceholder")}
                  value={nameRu}
                  onChange={(e) => setNameRu(e.currentTarget.value)}
                />
                <TextInput
                  label={t("wagons.number")}
                  placeholder={t("wagons.numberPlaceholder")}
                  withAsterisk
                  value={number}
                  onChange={(e) => setNumber(e.currentTarget.value)}
                />
                <Select
                  label={t("wagons.type")}
                  placeholder={
                    types.length
                      ? t("wagons.typePlaceholder")
                      : t("wagons.typePlaceholderEmpty")
                  }
                  withAsterisk
                  data={types}
                  value={typeId}
                  onChange={setTypeId}
                  searchable
                  nothingFoundMessage={t("wagons.noTypes")}
                />

                <TextInput
                  type="date"
                  label={t("wagons.startAt")}
                  withAsterisk
                  value={startDate}
                  onChange={(e) => setStartDate(e.currentTarget.value)}
                />
                {deadline && (
                  <Text size="xs" c="dimmed" mt={-6}>
                    {t("wagons.deadlineAuto", { date: formatDate(deadline) })}
                  </Text>
                )}

                <MultiSelect
                  label={t("wagons.stagesSelect", { n: stageIds.length })}
                  placeholder={
                    stageOptions.length
                      ? t("wagons.stagesSelectPlaceholder")
                      : t("wagons.stagesSelectEmpty")
                  }
                  data={stageOptions}
                  value={stageIds}
                  onChange={setStageIds}
                  searchable
                  clearable
                  hidePickedOptions
                  maxDropdownHeight={240}
                />
                <Text size="xs" c="dimmed" mt={-6}>
                  {t("wagons.stagesHint")}
                </Text>

                <div>
                  <Text size="sm" fw={500} mb={4}>
                    {t("wagons.creationApprovers")}{" "}
                    <Text span c="red">
                      *
                    </Text>
                  </Text>
                  <OrderedUserPicker
                    options={userOptions}
                    value={creationApproverIds}
                    onChange={setCreationApproverIds}
                  />
                  <Text size="xs" c="dimmed" mt={6}>
                    {t("wagons.creationApproversHint")}
                  </Text>
                </div>
              </Stack>
            </Stepper.Step>

            {/* ─────────── Шаг 2: ответственные ─────────── */}
            <Stepper.Step label={t("wagons.stepPeople")}>
              <Stack mt="md">
                <SegmentedControl
                  fullWidth
                  size="xs"
                  value={tab}
                  onChange={setTab}
                  data={[
                    { value: "seh", label: t("wagons.bySeh") },
                    { value: "stage", label: t("wagons.byStage") },
                  ]}
                />

                <div>
                  <Text size="sm" fw={500} mb={4}>
                    {t("wagons.commonResponsible")}
                  </Text>
                  <OrderedUserPicker
                    options={userOptions}
                    value={commonIds}
                    onChange={setCommonIds}
                  />
                  <Text size="xs" c="dimmed" mt={6}>
                    {t("wagons.commonResponsibleHint")}
                  </Text>
                </div>

                <Divider />

                {tab === "seh" ? (
                  <Stack gap="xs">
                    <Text size="xs" c="dimmed">
                      {t("wagons.sehHint")}
                    </Text>
                    {sehGroups.map((g) => {
                      const ids = sehUsers[g.seh] ?? [];
                      const opts = userOptions.filter(
                        (o) => !ids.includes(o.value)
                      );
                      return (
                        <Paper key={g.seh || "none"} withBorder p="sm" radius="md">
                          <Group gap={8} wrap="nowrap" mb={4}>
                            <IconBuildingFactory2
                              size={18}
                              color="var(--mantine-color-steel-6)"
                              style={{ flexShrink: 0 }}
                            />
                            <Text size="sm" fw={600} style={{ flex: 1 }}>
                              {g.seh
                                ? `${g.seh}-${sehWord}`
                                : t("wagons.sehNone")}
                            </Text>
                            <Badge size="sm" variant="light" color="gray">
                              {t("wagons.sehPositions", { n: g.stages.length })}
                            </Badge>
                          </Group>
                          <Text size="xs" c="dimmed" mb={8} lineClamp={2}>
                            {g.stages.map((s) => `№${s.number}`).join(" · ")}
                          </Text>
                          {ids.length > 0 && (
                            <Box mb={8}>
                              <UserPills
                                ids={ids}
                                users={userMap}
                                lang={lang}
                                sehWord={sehWord}
                                onRemove={(id) =>
                                  setSehValue(
                                    g.seh,
                                    ids.filter((x) => x !== id)
                                  )
                                }
                              />
                            </Box>
                          )}
                          <Select
                            size="xs"
                            placeholder={
                              ids.length
                                ? t("wagons.addUser")
                                : t("wagons.sehEmpty")
                            }
                            error={ids.length === 0 && commonIds.length === 0}
                            data={opts}
                            value={null}
                            onChange={(v) => v && setSehValue(g.seh, [...ids, v])}
                            searchable
                            nothingFoundMessage="—"
                            disabled={opts.length === 0}
                          />
                        </Paper>
                      );
                    })}
                  </Stack>
                ) : (
                  <Stack gap="xs">
                    <Text size="xs" c="dimmed">
                      {t("wagons.stageListHint")}
                    </Text>
                    {selectedStages.map((s) => {
                      const ids = resolved.get(s.id) ?? [];
                      const manual = overrides[s.id] !== undefined;
                      const open = editing === s.id;
                      const opts = userOptions.filter(
                        (o) => !ids.includes(o.value)
                      );
                      return (
                        <Paper
                          key={s.id}
                          withBorder
                          p="sm"
                          radius="md"
                          style={
                            ids.length
                              ? undefined
                              : { borderColor: "var(--mantine-color-red-4)" }
                          }
                        >
                          <Group gap={8} wrap="nowrap" align="flex-start">
                            <Badge size="sm" variant="light" color="gray">
                              №{s.number}
                            </Badge>
                            <Text size="xs" style={{ flex: 1 }} lineClamp={2}>
                              {pickName(s, lang)}
                            </Text>
                            {manual && (
                              <Badge size="xs" variant="light" color="steel">
                                {t("wagons.manualBadge")}
                              </Badge>
                            )}
                            <ActionIcon
                              variant={open ? "light" : "subtle"}
                              size="sm"
                              color="steel"
                              onClick={() => setEditing(open ? null : s.id)}
                            >
                              <IconPencil size={15} />
                            </ActionIcon>
                          </Group>

                          <Box mt={8}>
                            {ids.length > 0 ? (
                              <UserPills
                                ids={ids}
                                users={userMap}
                                lang={lang}
                                sehWord={sehWord}
                                onRemove={
                                  open
                                    ? (id) =>
                                        setStageValue(
                                          s.id,
                                          ids.filter((x) => x !== id)
                                        )
                                    : undefined
                                }
                              />
                            ) : (
                              <Text size="xs" c="red">
                                {t("wagons.noResponsible")}
                              </Text>
                            )}
                          </Box>

                          {open && (
                            <Stack gap={6} mt={8}>
                              <Select
                                size="xs"
                                placeholder={t("wagons.addUser")}
                                data={opts}
                                value={null}
                                onChange={(v) =>
                                  v && setStageValue(s.id, [...ids, v])
                                }
                                searchable
                                nothingFoundMessage="—"
                                disabled={opts.length === 0}
                              />
                              {manual && (
                                <Button
                                  variant="subtle"
                                  size="compact-xs"
                                  color="gray"
                                  leftSection={<IconRotate size={14} />}
                                  onClick={() => resetStage(s.id)}
                                >
                                  {t("wagons.resetToSeh")}
                                </Button>
                              )}
                            </Stack>
                          )}
                        </Paper>
                      );
                    })}
                  </Stack>
                )}

                {missing.length > 0 && (
                  <Alert color="red" variant="light" p="xs">
                    <Text size="xs">
                      {t("wagons.missingResponsible", {
                        list: missing
                          .slice(0, 8)
                          .map((s) => `№${s.number}`)
                          .join(", "),
                      })}
                    </Text>
                  </Alert>
                )}
              </Stack>
            </Stepper.Step>
          </Stepper>

          <Group justify="flex-end" gap="sm" style={footerStyle}>
            {step === 0 ? (
              <>
                <Button variant="default" onClick={onClose}>
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={goNext}
                  rightSection={<IconArrowRight size={16} />}
                >
                  {t("wagons.next")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="default"
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={() => setStep(0)}
                >
                  {t("common.back")}
                </Button>
                <Button onClick={save} loading={saving}>
                  {t("common.create")}
                </Button>
              </>
            )}
          </Group>
        </>
      )}
    </Modal>
  );
}
