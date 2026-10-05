import React from "react";
import { SkillPackageEditor } from "./SkillPackageEditor";
import registryFiles from "./worker-registry-files.json";

export const defaultWorkerFiles: Record<string, string> = registryFiles;

export function WorkerRegistryViewer({
  files,
  onChange,
  setError,
}: {
  files: Record<string, string>;
  onChange: (files: Record<string, string>) => void;
  setError: (error: string) => void;
}) {
  return (
    <SkillPackageEditor
      kind="workers"
      files={files}
      onChange={onChange}
      setError={setError}
      source="Worker registry"
    />
  );
}
