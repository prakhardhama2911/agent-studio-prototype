import React from "react";
import { SkillPackageEditor } from "./SkillPackageEditor";
import registryFiles from "./worker-registry-files.json";

export const defaultWorkerFiles: Record<string, string> = registryFiles;

export function WorkerRegistryViewer({
  readOnly = false,
  files,
  onChange,
  setError,
}: {
  readOnly?: boolean;
  files: Record<string, string>;
  onChange: (files: Record<string, string>) => void;
  setError: (error: string) => void;
}) {
  return (
    <SkillPackageEditor
      readOnly={readOnly}
      kind="workers"
      downloadable
      files={files}
      onChange={onChange}
      setError={setError}
      source="Worker registry"
    />
  );
}
