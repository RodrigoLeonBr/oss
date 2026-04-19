module.exports = {
    apps: [
        {
            name: 'saudecontrol-oss',
            script: 'npm',
            args: 'start',
            cwd: '.',
            env: {
                NODE_ENV: 'production',
                PORT: 3001,
            },
        },
    ],
};
