// Servidor MCP stdio "oss-relatorios" (somente leitura). Registro: docs/api-claude-chat.md.
require('../core/bootstrap'); // primeiro: stdout limpo + credenciais RO
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { registro, executar } = require('../core/ferramentas');

const server = new McpServer({ name: 'oss-relatorios', version: '0.1.0' });

for (const f of registro.values()) {
    server.registerTool(
        f.nome,
        { description: f.descricao, inputSchema: f.schema },
        async (params) => {
            const r = await executar(f.nome, params, { canal: 'mcp' });
            return { content: [{ type: 'text', text: r.texto }], isError: !r.ok };
        },
    );
}

server.connect(new StdioServerTransport()).then(() => {
    return console.error(`oss-relatorios: ${registro.size} ferramentas`);
});
