import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWorkflow = (name: string): string =>
  readFileSync(resolve(process.cwd(), `.github/workflows/${name}.yml`), "utf8");
const cdWorkflow = readWorkflow("cd");
const ciWorkflow = readWorkflow("ci");
const packageMetadata = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
const repositorySlug = new URL(packageMetadata.repository.url.replace(/^git\+/u, ""))
  .pathname.replace(/^\/|\.git$/gu, "");

describe("package release trust boundary", () => {
  it("uses exact-main hosted OIDC publication without write tokens", () => {
    expect(cdWorkflow).toContain("runs-on: ubuntu-latest");
    expect(cdWorkflow).toContain("environment: production");
    expect(cdWorkflow).toContain("id-token: write");
    expect(cdWorkflow).toContain("Enforce exact-main successful CI");
    expect(cdWorkflow).toContain("refs/remotes/origin/main");
    expect(cdWorkflow).toContain("-f branch=main");
    expect(cdWorkflow).toContain("-f event=push");
    expect(cdWorkflow).toContain('-f head_sha="${EXPECTED_SHA}"');
    expect(cdWorkflow).toContain('conclusion == "success"');
    expect(cdWorkflow).toContain("Verify release runtime");
    expect(cdWorkflow).toContain('ACTUAL_NODE%%.*');
    expect(cdWorkflow).toContain('"11.5.1"');
    expect(cdWorkflow).toContain("--provenance");
    expect(cdWorkflow).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN/u);
  });

  it("admits only trusted push and manual CI events", () => {
    expect(ciWorkflow).toContain("workflow_dispatch:");
    expect(ciWorkflow).toMatch(/push:\s*\n\s+branches: \['\*\*'\]/u);
    expect(ciWorkflow).toContain("package-manager-cache: false");
    expect(ciWorkflow).not.toMatch(/pull_request|workflow_call|repository_dispatch/u);
    expect(ciWorkflow).toContain("group: ci-${{ github.repository }}-${{ github.ref }}");
    expect(ciWorkflow).toContain("cancel-in-progress: true");
  });

  const ciJobs = ciWorkflow.split(/^jobs:\s*$/mu)[1] ?? "";
  const jobBlocks = [...ciJobs.matchAll(/^ {2}([\w-]+):\n([\s\S]*?)(?=^ {2}[\w-]+:|$(?![\s\S]))/gmu)]
    .map((job) => ({ name: job[1] ?? "", contents: job[2] ?? "" }));

  it("accounts for every CI job", () => {
    expect(jobBlocks.map((job) => job.name)).toEqual(["build-test", "public_artifact_integrity"]);
  });

  it.each(jobBlocks)("isolates $name on approved self-hosted runners", ({ contents: job }) => {
    expect(job.match(/^ {4}runs-on: (.+)$/gmu)).toEqual(["    runs-on: [self-hosted, Linux, X64]"]);
    expect(job).toContain(`if: \${{ github.repository == '${repositorySlug}' && (github.event_name == 'push' || github.event_name == 'workflow_dispatch') }}`);
    expect(job).toMatch(/^ {4}timeout-minutes: (?:10|20)$/mu);
    expect(job).toContain("persist-credentials: false");
    expect(job).not.toMatch(/\buses:.*\.github\/workflows\//u);
  });
});
