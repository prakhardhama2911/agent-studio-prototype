import { useEffect, useRef, useState } from "react";
import type { StudioData } from "./types";
import { loadDraft } from "./lib/core.mjs";
import { hydrateSampleSkills } from "./data";

export const studioUsers = [
  { id: "user-a", name: "Prakhar", role: "Admin" },
  { id: "user-b", name: "User B", role: "User" },
  { id: "user-c", name: "User C", role: "SuperAdmin" },
];
interface StudioSession {
  revision: number;
  published: StudioData;
  lock: null | {
    id: string;
    ownerId: string;
    ownerName: string;
    startedAt: string;
    savedAt: string | null;
    working: StudioData;
  };
}

/** Browser-only simulation. A backend must own these operations in the real application. */
export function useStudioSession(
  key: string,
  seed: StudioData,
  onData: (data: StudioData) => void,
) {
  const storageKey = `${key}:exclusive-edit:v1`;
  const [userId, setUserId] = useState(() => {
    try {
      return sessionStorage.getItem("studio-demo-user") || "user-a";
    } catch {
      return "user-a";
    }
  });
  const user = studioUsers.find((item) => item.id === userId) || studioUsers[0];
  const [state, setState] = useState<StudioSession | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const fallback = useRef(seed);
  fallback.current = seed;
  const read = (): StudioSession => {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const value = JSON.parse(raw) as StudioSession;
      if (
        !Number.isInteger(value.revision) ||
        !value.published?.agents ||
        !("lock" in value)
      )
        throw Error(
          "Saved edit session could not be read. Your stored data has not been changed.",
        );
      return value;
    }
    const previous = loadDraft(localStorage, key);
    const published = previous || fallback.current;
    return {
      revision: 0,
      published: key.endsWith(":sample")
        ? hydrateSampleSkills(published)
        : published,
      lock: null,
    };
  };
  const apply = (next: StudioSession, id = user.id) => {
    setState(next);
    onData(next.lock?.ownerId === id ? next.lock.working : next.published);
  };
  useEffect(() => {
    const refresh = () => {
      try {
        apply(read());
        setError("");
      } catch (e) {
        setError((e as Error).message);
        setState(null);
      }
    };
    refresh();
    const changed = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) refresh();
    };
    window.addEventListener("storage", changed);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", changed);
      window.removeEventListener("focus", refresh);
    };
  }, [storageKey, user.id]);

  const transact = async (
    change: (current: StudioSession) => StudioSession,
  ) => {
    setPending(true);
    setError("");
    try {
      if (!navigator.locks)
        throw Error(
          "Edit mode requires a browser with Web Locks support on HTTPS or localhost.",
        );
      return await navigator.locks.request(storageKey, () => {
        const current = read();
        const next = change(current);
        // One write keeps lock ownership, private saves and visible data consistent.
        localStorage.setItem(storageKey, JSON.stringify(next));
        apply(next);
        return next.revision;
      });
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setPending(false);
    }
  };
  const requireOwner = (current: StudioSession) => {
    if (
      !state?.lock ||
      current.lock?.id !== state.lock.id ||
      current.lock.ownerId !== user.id
    )
      throw Error(
        "You no longer hold the edit lock. Reopen the latest development version.",
      );
  };
  const begin = () =>
    transact((current) => {
      if (current.lock)
        throw Error(`Agent Studio is locked by ${current.lock.ownerName}.`);
      return {
        ...current,
        revision: current.revision + 1,
        lock: {
          id: crypto.randomUUID(),
          ownerId: user.id,
          ownerName: user.name,
          startedAt: new Date().toISOString(),
          savedAt: null,
          working: structuredClone(current.published),
        },
      };
    });
  const save = (next: StudioData, expectedRevision = state?.revision) =>
    transact((current) => {
      requireOwner(current);
      if (expectedRevision !== current.revision)
        throw Error(
          "This edit session changed in another tab. Close and reopen the workspace before saving again.",
        );
      return {
        ...current,
        revision: current.revision + 1,
        lock: {
          ...current.lock!,
          working: next,
          savedAt: new Date().toISOString(),
        },
      };
    });
  const finish = () =>
    transact((current) => {
      requireOwner(current);
      return {
        revision: current.revision + 1,
        published: current.lock!.working,
        lock: null,
      };
    });
  const switchUser = (id: string) => {
    if (!studioUsers.some((item) => item.id === id)) return;
    try {
      const current = read();
      sessionStorage.setItem("studio-demo-user", id);
      setUserId(id);
      apply(current, id);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return {
    user,
    switchUser,
    lock: state?.lock ?? null,
    revision: state?.revision ?? 0,
    canEdit: !!state?.lock && state.lock.ownerId === user.id,
    ready: !!state,
    pending,
    error,
    begin,
    save,
    finish,
  };
}
