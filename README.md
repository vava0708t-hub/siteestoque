# Repõe — lista de reposição

Base em HTML, CSS e JavaScript puro, com Supabase Auth e PostgreSQL. Arquivos públicos em `dist/`; SQL fora da pasta pública. Sem framework ou etapa de build.

## Publicar na Vercel pelo GitHub

Envie o projeto inteiro ao repositório, incluindo `dist` e `vercel.json`. Na Vercel, selecione Add New > Project, importe esse repositório e mantenha Root Directory na raiz. O `vercel.json` configura Framework Preset como Other, dispensa instalação/build e publica somente `dist`.

Depois do deploy, configure a URL HTTPS de produção em Supabase > Authentication > URL Configuration > Site URL. Execute o SQL de instalação se ainda não tiver feito isso. O catálogo continua dependendo do link CSV em `dist/config.js`. Cada alteração enviada à branch de produção do repositório integrado gera uma nova publicação pela Vercel.

Não é necessário cadastrar variáveis de ambiente na Vercel nesta versão: o site estático lê as configurações públicas de `dist/config.js`. Nunca cadastre uma chave secreta nesse arquivo. A publicação das telas, por si só, não valida autenticação, SQL ou catálogo.

## Configurar

1. Revogue a chave secreta compartilhada na conversa no painel Supabase. Ela não foi incluída no projeto; o navegador utiliza somente a chave publicável.
2. Abra um **projeto** Supabase, use **Connect** para obter a Project URL (`https://SEU-PROJETO.supabase.co`) e preencha `supabaseUrl` em `dist/config.js`. A URL da organização no dashboard não é a URL da API.
3. Execute `supabase/schema.sql` uma única vez no SQL Editor, antes de cadastrar usuários. Use um projeto novo ou revise conflitos com tabelas existentes antes de executar.
4. Em Authentication, habilite e-mail/senha e configure a Site URL com o endereço onde o site será acessado. A confirmação de e-mail segue a configuração do Supabase.
5. Para catálogo público: crie uma aba com cabeçalhos `codigo,nome,unidade,categoria` (somente os dois primeiros são obrigatórios), publique **apenas essa aba** em Arquivo > Compartilhar > Publicar na Web, formato CSV. Cole o endereço publicado em `googleSheetsCsvUrl`. Publicar permite que qualquer pessoa com o endereço leia o catálogo; não publique dados privados.
6. Sirva a pasta `dist` por HTTP. Se tiver Python: `python -m http.server 5500 --directory dist`, e acesse http://localhost:5500. Não abra por file://, pois módulos JavaScript precisam de servidor HTTP.

## Perfis e autorização

Os cadastros entram como vendedor. Quem solicita o perfil estoquista aguarda aprovação do responsável no banco. No SQL Editor, após verificar o colaborador:

```sql
update public.profiles set role = 'estoquista' where id = 'UUID-DO-USUARIO';
```

O cliente não pode alterar perfis. Vendedores criam pedidos; estoquistas aprovados também concluem pedidos por função protegida no banco. Todos os usuários cadastrados veem a fila da mesma loja. Esta base é para uma única equipe, sem isolamento entre empresas; controlar admissão de vendedores é uma evolução necessária se o cadastro não puder ser aberto.

## Catálogo e pedidos

A planilha é lida na entrada e ao clicar em Atualizar lista. Não há escrita de volta nem atualização em tempo real. O pedido salva código, nome e unidade como fotografia do produto naquele momento. Dados de produtos enviados pelo cliente são validados em formato pelo banco, mas não comparados a um catálogo autoritativo. Caso precise dessa garantia, importe o catálogo para uma tabela protegida e valide por referência.

Planilha privada exige backend/Edge Function com acesso Google autorizado; não coloque credenciais Google no JavaScript. Essa modalidade depende do link e da definição de privacidade da planilha e não está conectada nesta base.

## Validação

`node --test tests/catalog.test.mjs` verifica parsing CSV (aspas, vírgulas, quebras de linha, BOM, cabeçalhos e códigos duplicados). Login, políticas RLS e gravação precisam ser validados no projeto real após configurar a URL e executar o SQL. Roteiro: cadastrar vendedor, confirmar e-mail, criar pedido; cadastrar estoquista, aprovar via SQL e concluir; verificar que vendedor não pode executar `complete_restock` nem alterar `profiles.role` via API. Testar toast com hover/foco e responsividade antes da publicação.

Arquivos: `index.html` estrutura; `style.css` visual e animações; `script.js` autenticação e pedidos; `catalog.js` leitura CSV; `toast.js` notificações; `config.js` configurações públicas.
