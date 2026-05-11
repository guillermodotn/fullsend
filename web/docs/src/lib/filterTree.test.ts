import { describe, expect, it } from "vitest";
import { filterTree } from "./filterTree";
import type { ManifestNode } from "virtual:fullsend-docs";

const tree: ManifestNode[] = [
  {
    type: "dir",
    name: "guides",
    children: [
      {
        type: "dir",
        name: "admin",
        children: [
          {
            type: "file",
            name: "installation",
            routeKey: "guides/admin/installation",
            title: "Installation Guide",
          },
          {
            type: "file",
            name: "config",
            routeKey: "guides/admin/config",
            title: "Configuration",
          },
        ],
      },
      {
        type: "file",
        name: "quickstart",
        routeKey: "guides/quickstart",
        title: "Quickstart",
      },
    ],
  },
  {
    type: "file",
    name: "readme",
    routeKey: "readme",
    title: "README",
  },
];

describe("filterTree", () => {
  it("returns full tree when query is empty", () => {
    expect(filterTree(tree, "")).toBe(tree);
    expect(filterTree(tree, "  ")).toBe(tree);
  });

  it("matches file by title", () => {
    const result = filterTree(tree, "quickstart");
    expect(result).toEqual([
      {
        type: "dir",
        name: "guides",
        children: [
          {
            type: "file",
            name: "quickstart",
            routeKey: "guides/quickstart",
            title: "Quickstart",
          },
        ],
      },
    ]);
  });

  it("keeps ancestor dirs for nested match", () => {
    const result = filterTree(tree, "installation");
    expect(result).toEqual([
      {
        type: "dir",
        name: "guides",
        children: [
          {
            type: "dir",
            name: "admin",
            children: [
              {
                type: "file",
                name: "installation",
                routeKey: "guides/admin/installation",
                title: "Installation Guide",
              },
            ],
          },
        ],
      },
    ]);
  });

  it("prunes branches with no matches", () => {
    const result = filterTree(tree, "zzz");
    expect(result).toEqual([]);
  });

  it("matches case-insensitively", () => {
    const result = filterTree(tree, "README");
    expect(result).toEqual([
      { type: "file", name: "readme", routeKey: "readme", title: "README" },
    ]);
  });

  it("matches dir name and keeps full subtree", () => {
    const result = filterTree(tree, "admin");
    expect(result).toEqual([
      {
        type: "dir",
        name: "guides",
        children: [
          {
            type: "dir",
            name: "admin",
            children: [
              {
                type: "file",
                name: "installation",
                routeKey: "guides/admin/installation",
                title: "Installation Guide",
              },
              {
                type: "file",
                name: "config",
                routeKey: "guides/admin/config",
                title: "Configuration",
              },
            ],
          },
        ],
      },
    ]);
  });
});
