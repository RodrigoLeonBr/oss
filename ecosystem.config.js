module.exports = {
    apps: [
        {
            name: 'saudecontrol-oss',
            script: 'npm',
            args: 'start',
            cwd: '.',
            env: {
                NODE_ENV: 'production',
                PORT: 4001,
            },
        },
        {
            // Ponte por arquivos do chat Claude (contingência do MCP). Roda no HOST, não no container.
            name: 'oss-claude-ponte',
            script: 'src/claude/ponte/vigia.js',
            cwd: '.',
        },
    ],
};
