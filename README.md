# Repõe — instalação e atualização
Frontend em HTML, CSS e JavaScript puro. Autenticação e banco no Supabase; login por usuário em uma função JavaScript da Vercel.

## Banco
- Instalação nova: execute `supabase/schema.sql`, depois `supabase/002_roles_username.sql` no SQL Editor.
- Se a primeira versão já foi instalada: execute somente `supabase/002_roles_username.sql`, uma vez.
- A migração preserva os pedidos e acessos existentes. Contas antigas recebem um usuário provisório `user_...`; consulte a tabela profiles e defina o nome desejado. Não altera senhas.

## Primeiro administrador
Cadastre uma conta pela tela, confirme seu e-mail e promova essa conta no SQL Editor:
```sql
update public.profiles set role='admin', active=true where username='seu.usuario';
```
Não há senha administrativa padrão. A partir daí o painel permite aprovar, bloquear e atribuir perfis aos demais usuários. O administrador não pode bloquear/rebaixar a própria conta pelo painel.

## Vercel
Importe o repositório com a pasta raiz padrão. O arquivo vercel.json publica dist e a função api/login.js fornece /api/login.
Em Settings > Environment Variables configure, para o ambiente desejado:
- SUPABASE_URL: https://nldknkqukenyqkxnutaf.supabase.co
- SUPABASE_PUBLISHABLE_KEY: a chave publicável do projeto.
- SUPABASE_SECRET_KEY: uma **nova** chave secreta, gerada após revogar a que foi compartilhada. Insira somente no painel Vercel, nunca no código ou na conversa.
Faça redeploy após configurar. O servidor resolve o usuário para o e-mail interno e valida a senha no Supabase; retorna somente os tokens da sessão. Configure limitação de tentativas em /api/login no firewall da Vercel antes de abrir o sistema ao público; o Supabase também aplica limites de autenticação.
No Supabase, configure Authentication > URL Configuration > Site URL com a URL HTTPS de produção. Habilite e-mail/senha. E-mail é usado no cadastro e confirmação; login usa nome de usuário e senha.

## Perfis
- Vendedor e repositor aprovados: solicitam produtos.
- Estoquista aprovado: consulta e conclui reposições.
- Admin aprovado: acompanha/conclui solicitações e gerencia acessos.
- Novos cadastros: aguardam aprovação; não podem ler nem inserir solicitações.
As permissões são verificadas no banco, inclusive para sessões já abertas. Todos os aprovados pertencem à mesma loja e veem a fila da equipe.

## Bipagem e planilha
Campo compatível com leitor USB/Bluetooth em modo teclado, configurado para enviar Enter após o código. Também aceita digitação e busca pelo botão; não há leitura por câmera nesta versão.
Solicitação: produto, corredor obrigatório, UND/CX/PCT/fardo/KG/LT, quantidade inteira, prioridade e observação.
O corredor permanece preenchido após enviar para agilizar o próximo pedido. Unidade é a embalagem solicitada; não há conversão entre caixa e unidade.
Depois, configure googleSheetsCsvUrl em dist/config.js com o CSV público da aba de produtos. Colunas: codigo,nome; opcionais codigo_barras,unidade,categoria. Formate códigos como texto na planilha para preservar zeros. Sem planilha, o formulário informa catálogo indisponível e impede enviar.
A planilha é lida ao entrar/atualizar; não escreve de volta. Planilha privada exige outra integração no servidor.
Nomes e códigos são registrados como fotografia do catálogo; não existe validação de existência do produto contra uma tabela autoritativa no banco.

## Verificação
Execute `node --test tests/*.test.mjs`. Testes locais cobrem CSV, regras de interface e endpoint de login com respostas simuladas.
Para validar em produção: executar migração, configurar variáveis, cadastrar usuário, confirmar e-mail, promover primeiro admin, aprovar repositor e estoquista, conectar catálogo e solicitar/concluir por contas separadas. Testar negação de conclusão pelo vendedor e negação de alteração de perfis por não administradores.
Para desenvolvimento com login, use Vercel CLI (`vercel dev`); um servidor estático simples exibe telas mas não executa /api/login.
