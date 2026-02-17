module.exports = {
  branches: ["main"],

  plugins: [
    // Analyze commit messages (Conventional Commits)
    "@semantic-release/commit-analyzer",

    // Generate release notes
    "@semantic-release/release-notes-generator",

    // Update CHANGELOG.md
    "@semantic-release/changelog",

    // Commit CHANGELOG.md + package.json back to repo
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json"],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
  tagFormat: false,
};
