# Repõe — sistema interno de reposição

HTML, CSS e JavaScript puro no frontend, Supabase para autenticação/banco e funções JavaScript na Vercel. Login e cadastro não pedem e-mail.

## Atualizar uma instalação existente
1. Se já executou schema.sql e 002_roles_username.sql, execute somente **supabase/003_internal_accounts.sql**, uma vez, no SQL Editor do Supabase.
2. Mantenha as três variáveis de ambiente configuradas na Vercel: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY. Use a nova chave secreta, nunca a que foi compartilhada.
3. Publique a pasta do projeto com `vercel --prod --yes`.

Para instalação nova, execute os arquivos SQL nesta ordem:
- supabase/schema.sql
- supabase/002_roles_username.sql
- supabase/003_internal_accounts.sql

Não repita migrações já executadas. Os scripts preservam as contas e solicitações existentes. A migração 003 confirma as contas antigas da loja para que nenhuma dependa de confirmação por e-mail.

## Administrador inicial
Depois da migração e publicação, entre com:
- Usuário: **admin**
- Senha: **admin**

A API cria essa conta na primeira entrada. Ela já recebe o perfil admin aprovado. O nome admin é reservado e não pode ser usado no cadastro comum.
Um marcador permanente no banco impede recriar o acesso padrão após renomear ou excluir a conta. Trocar a senha também não reativa a senha anterior.
Se já existe uma conta chamada admin, a instalação preserva sua senha e seu perfil; não os redefine automaticamente.

Use **Configurações** após entrar para alterar o nome, o nome de usuário e a senha. A troca de senha exige a senha atual e confirmação da nova, e pede novo login. Novas senhas têm de 6 a 128 caracteres. A senha inicial admin é uma exceção prevista somente na criação inicial.

## Cadastro sem e-mail
A tela solicita nome, usuário, senha e perfil (vendedor, repositor ou estoquista). A API cria uma identidade interna já confirmada no Supabase; nenhum e-mail é enviado ou solicitado ao colaborador.
Novas contas ficam pendentes até aprovação do administrador. Elas podem entrar e editar seus próprios dados, mas não ler nem enviar solicitações enquanto não forem aprovadas.
O provedor de senha do Supabase deve permanecer habilitado; não é necessário desligar a confirmação global de e-mail, porque a criação é feita no servidor com email_confirm.

## Configurações de conta
O botão Configurações abre Meus dados (nome e usuário) e Alterar senha (atual, nova e confirmação).
O servidor valida a sessão e só altera a própria conta. Campos extras como role, active e ID de outro usuário são ignorados. Nome de usuário é único, minúsculo e tem 3 a 30 caracteres (letras, números, ponto, hífen ou sublinhado).
O painel administrativo continua separado e permite aprovar/bloquear contas e definir os quatro perfis.

## Vercel
Importe o repositório com Root Directory na raiz. vercel.json publica dist e as funções api/login.js, api/register.js e api/account.js.
Variáveis em Settings > Environment Variables:
- SUPABASE_URL: https://nldknkqukenyqkxnutaf.supabase.co
- SUPABASE_PUBLISHABLE_KEY: chave publicável do projeto
- SUPABASE_SECRET_KEY: nova chave secreta, somente no servidor

Faça redeploy após configurar variáveis. Nenhuma chave secreta é salva no código ou no navegador.
A pasta lib contém os auxiliares das funções e não é publicada como conteúdo estático.
No desenvolvimento, use `vercel dev`; servidor somente estático não executa os endpoints /api.

## Perfis e solicitações
- Vendedor e repositor aprovados: solicitam produtos.
- Estoquista aprovado: consulta e conclui reposições.
- Admin aprovado: acompanha/conclui solicitações e gerencia acessos.
As permissões de dados são verificadas no banco, inclusive para sessões já abertas. Todos os aprovados pertencem à mesma loja.

Campo de bipagem compatível com leitor USB/Bluetooth em modo teclado, enviando Enter após o código. Também aceita digitação e seleção; não usa câmera.
Cada solicitação registra produto, corredor obrigatório, unidade (UND/CX/PCT/fardo/KG/LT), quantidade inteira, prioridade e observação. Não há conversão automática entre embalagens.

## Planilha
Configure googleSheetsCsvUrl em dist/config.js quando o CSV estiver disponível. Colunas obrigatórias: codigo,nome; opcionais: codigo_barras,unidade,categoria.
Formate códigos como texto para preservar zeros. Sem planilha o envio fica desabilitado. A leitura ocorre ao entrar/atualizar; não há escrita de volta. Planilha privada requer outra integração no servidor.
O pedido armazena uma fotografia do produto; não compara código e nome contra um catálogo autoritativo no banco.

## Detalhes da autenticação
As senhas novas passam por um prehash SHA-256 versionado no servidor antes do hash do Supabase. Isso permite a senha inicial de cinco caracteres sem alterar a política de tamanho do Supabase e evita truncamento do bcrypt. A versão fica em app_metadata, que o usuário comum não pode editar.
Contas legadas continuam verificadas com o formato antigo até trocarem a senha. Não se armazenam senhas em profiles nem se retorna senha em respostas de API.
O cadastro e a criação inicial usam a API administrativa no servidor; não use a chave secreta no frontend.
Recomenda-se configurar limitação de tentativas no firewall da Vercel para /api/login e /api/register ao expor o site.

## Verificação
Execute `npm test`. Testes locais cobrem catálogo, perfis, login legado, admin inicial e não recriação, cadastro sem e-mail, edição limitada à própria conta e troca de senha com verificação da atual.
A aplicação real das políticas SQL e o fluxo na Vercel precisam de validação após configurar o ambiente: entrar como admin, mudar nome/senha, confirmar que admin/admin deixa de funcionar, cadastrar/aprovar colaborador e solicitar/concluir com os perfis correspondentes.

## Planilha vinculada em 18/09/2026
A configuração aponta para a aba gid=300918174 da planilha informada. A leitura CSV foi verificada sem autenticação. Não é necessário alterar cabeçalhos: o modo estoque-sem-cabecalho interpreta A=código interno, B=código de barras, C=descrição e D=unidade. As demais colunas não são usadas pelo site.
Repetições dos mesmos quatro campos são removidas. Códigos com descrições/unidades diferentes são preservados; uma bipagem ambígua exige seleção manual. Zeros iniciais são preservados e aspas externas dos códigos são removidas. UN é convertido para UND. Unidades não reconhecidas exigem escolha explícita da embalagem da solicitação.
A busca por nome/código mostra até 80 resultados; a bipagem procura em todo o catálogo. Não há filtro automático pelo campo S/N, cujo significado não foi confirmado. Após salvar alterações na planilha, clique em Atualizar lista para reler os produtos. Publique os arquivos locais para disponibilizar a integração na Vercel.

## Correção do administrador inicial
Execute supabase/004_fix_initial_admin.sql após a migração 003. A conta é criada com usuário provisório sem privilégios; uma função exclusiva do servidor verifica os metadados administrativos já persistidos e finaliza o perfil admin em transação. O marcador permanente continua impedindo recriação. Contas e pedidos existentes são preservados.

## Listas completas de reposição
Antes de publicar esta versão, execute supabase/005_restock_lists.sql uma vez. Os pedidos antigos são preservados como listas de um item, mantendo o estado anterior. Depois publique com vercel --prod --yes.
Vendedor/repositor: busque ou bipe o produto, informe os dados e clique em Adicionar à lista. Revise quantidade, unidade, corredor e observação; remova itens se necessário. Enviar lista grava todos os itens em uma transação. Limite: 200 itens por lista. O rascunho fica no sessionStorage por usuário e aba; fechar a aba pode removê-lo. Não há envio automático ao bipar.
Estoquista/admin: abra uma lista numerada, marque cada item separado e confirme como pronta. O banco exige todos separados e verifica o perfil. Listas prontas não podem mais ser editadas. Os filtros de estado e corredor continuam disponíveis; a busca do catálogo permanece por código, código de barras e descrição.
A fila é relida a cada 30 segundos enquanto a aba está visível. O solicitante vê Pronta para retirada e recebe um toast quando uma lista previamente carregada muda para pronta. Atualizar lista também relê manualmente. Ainda não há notificações fora da página nem confirmação de retirada.
Testes: npm test inclui PostgreSQL local via PGlite, com migração de histórico, RLS, envio atômico, repetição idempotente e separação/conclusão. A migração precisa ser executada no Supabase real para ativar o fluxo em produção.

## Editar e excluir listas pendentes
Execute também supabase/006_edit_pending_lists.sql depois da 005 e antes de publicar. Vendedores e repositores ativos podem editar ou excluir somente suas próprias listas pendentes. A primeira marcação de item pelo estoque inicia a separação e bloqueia essas ações. Edição preserva número e autoria; permite adicionar/remover produtos e alterar quantidade, embalagem, corredor, prioridade e observação. O rascunho anterior é restaurado após salvar/cancelar. O banco trava a lista durante alterações e rejeita versões antigas para evitar sobrescritas entre abas.

## Itens em falta e ordenação
Execute supabase/007_unavailable_items.sql após a 006 e antes de publicar. Estoquista/admin podem escolher A separar, Separado ou Em falta; escolher uma situação inicia a separação. Itens em falta não são contados como separados. A lista pode ser finalizada quando todos os itens estão separados ou em falta, inclusive se todos estiverem em falta; a tela informa retirada parcial ou nenhum item disponível. Listas finalizadas permanecem bloqueadas. Solicitantes visualizam as faltas. Ordenação por nome A–Z/Z–A ou quantidade crescente/decrescente é local, em cada lista, sem converter embalagens.

A situação do item agora usa somente os botões Separado e Em falta. Novos itens permanecem pendentes sem seleção até a primeira escolha. Organização por marca agrupa VMP, Futuro, Mercur e Master Print identificadas na descrição, ordena produtos por nome dentro do grupo e mantém os demais no grupo Sem marca identificada. Esta alteração visual não exige nova migração; o status em falta depende da 007 já existente.

## Marcas, corredores e cliente esperando
Execute 008_brands_aisles.sql após 007 antes de publicar. Admin gerencia marcas e corredores; leitura para colaboradores ativos, escrita exclusiva de admin por RLS. Marcas são identificadas por palavras na descrição, sem diferenciar acentos/maiúsculas; marcas não cadastradas ficam sem identificação. A migração cadastra as quatro marcas iniciais e importa corredores do histórico. Exclusões não alteram solicitações existentes. Novos itens usam seleção de corredor; edições preservam também o corredor antigo. A caixa Para cliente esperando define urgência da lista inteira ao enviar/salvar. Listas urgentes não finalizadas recebem destaque e aparecem primeiro.

## Exclusão pelo administrador
Execute 009_admin_delete_lists.sql após 008. Admin ativo pode excluir qualquer lista, em qualquer status, com confirmação na interface. A exclusão remove os itens e a lista em uma transação. Vendedor/repositor continuam limitados às próprias listas pendentes; estoquista não pode excluir.

## Impressão de lista pronta
Todos os perfis ativos podem imprimir listas prontas pelo botão Imprimir lista. A impressão A4 contém solicitante, datas, corredores, produtos, quantidade/embalagem, observações, situação e caixa vazia OK para conferência com caneta. Mantém a ordenação da tela e identifica faltas. Sem nova migração.

Impressão disponível para todos os perfis ativos em qualquer status: pendente, em separação ou pronta. O documento mostra o status da lista e a situação real de cada item, mantendo as caixas para conferência manual.

## Saldo da planilha
A coluna F é exibida como Estoque (planilha) na busca, no produto selecionado, no rascunho e na separação. Valor preservado como texto, inclusive zeros e decimais. Campo vazio é não informado; saldos conflitantes são sinalizados. Atualizar lista relê o saldo. Não reserva nem desconta estoque e não converte embalagens; usa a unidade da coluna D. Sem nova migração.

## Redução de transferência
A tela inicia em Em andamento. Carrega 20 listas por página (consulta um registro extra para detectar a próxima página); atualização automática a cada 60 segundos só em filtros ativos e aba visível. Todas/histórico e Prontas não têm consulta periódica. As contagens e o filtro de corredor referem-se à página atual. Avisos de conclusão consultam somente id/número/status de até 20 listas acompanhadas que saíram da página. Nenhum histórico é apagado. Sem migração.

## Terminal de consulta
Terminal abaixo das listas consulta o catálogo já carregado, por código interno/barras ou descrição, sem acessar Supabase. Exibe C descrição, D unidade, E preço preservado no formato da planilha, F estoque e G promoção (S/N; outros valores são não informados). Resultados limitados a 30 para refinar a busca. Atualizar lista renova os dados e limpa a consulta anterior. Sem migração.

## Notificações desativadas
A caixa de avisos foi retirada, sem consultas periódicas de notificações. Não aplique a migração 010 em novas instalações. Se ela já foi aplicada, execute 011_disable_notifications.sql para interromper a geração de eventos, preservando as listas e os eventos já gravados.

## Separação e histórico (012)
Execute 012_separation_workflow.sql após 009 (010/011 são opcionais). Iniciar separação registra responsável e horário sob bloqueio transacional; outros estoquistas não alteram a lista, admin pode intervir. Quantidade atendida de 0 até solicitado; o restante é falta, sem conversão de embalagem. Impressão inclui atendido/falta e responsável. Duplicidade por código/corredor em listas abertas é avisada ao adicionar, uma consulta indexada limitada a 5 resultados, sem bloquear duplicações justificadas. Filtros de data local e nome do solicitante são aplicados no servidor somente ao clicar Aplicar filtros; 20 listas por página, sem polling do histórico. Data exibida é a hora da leitura bem-sucedida da planilha, não a data de edição do Google Sheets.

## Leitores e consulta offline

Execute `npm ci` e `npm run build` antes de publicar. A Vercel executa esse build para gerar os arquivos locais do Quagga2, Tesseract e Workbox. Não copie somente os arquivos fonte para produção.

A câmera usa ZXing 0.1.5 servido pelo próprio site. O Quagga2 foi retirado do fluxo de leitura após relato de regressão. A opção Ler descrição pela câmera usa Tesseract em português, com revisão do texto antes da busca. Fotos ficam no dispositivo; o modelo de idioma exige internet na primeira leitura. Bibliotecas OCR são carregadas sob demanda, fora do precache.

Workbox disponibiliza /offline.html após a primeira visita online. A última leitura bem-sucedida da planilha salva uma única cópia pública do catálogo neste navegador, com data e opção de apagar. Não são armazenadas respostas de autenticação, listas ou APIs Supabase, nem enfileiradas escritas offline. As novas consultas não fazem chamadas adicionais ao Supabase. O catálogo salvo pode ficar desatualizado. Leitura pela câmera e OCR precisam de teste em aparelhos reais.

### Lista offline para impressão
Em /offline.html, o catálogo público salvo permite montar uma lista, editar quantidades, embalagens, corredores e observações. Dexie/IndexedDB preserva um rascunho por navegador, inclusive após reabrir a página. Informe o solicitante manualmente; não há autenticação ou acesso a listas do servidor nessa página. Os itens guardam o saldo e a data do catálogo usado ao adicioná-los. A impressão informa claramente que a lista não foi enviada ao estoque. Reconectar não envia nem sincroniza o rascunho. Limpar rascunho exige confirmação; apagar catálogo não remove itens já adicionados. Dados podem ser perdidos ao limpar dados do navegador.

## Navegação, orçamento e relatórios
O menu organiza Visão geral, Reposição, Consulta produtos, Relatórios, Configurações e Como usar. No celular, abra o botão Menu; a página atual é destacada e o menu fecha ao escolher uma função. Os formulários existentes são preservados ao alternar telas.

O orçamento usa os valores da coluna E e a unidade da coluna D, aceita desconto percentual por item e imprime ou salva como PDF pelo navegador. O rascunho é salvo em sessionStorage por usuário, sem gravar pedidos nem reservar estoque. Valores ausentes não são tratados como zero.

Relatórios consultam o banco somente ao gerar, por período de até 93 dias, em lotes de 500 registros e limite de 5.000 itens. Acima disso, solicitam reduzir o período, sem mostrar totais parciais. O resultado fica em memória por cinco minutos para filtros idênticos. Estoque/admin veem a equipe e vendedor/repositor recebem filtro de suas próprias solicitações. O ranking conta listas distintas e mantém separadas as embalagens/variantes de descrição. Nenhuma migração SQL nova é necessária. Atualização periódica da fila fica ativa apenas em Visão geral/Reposição.

O guia possui instruções por perfil e uma simulação local sem gravar dados. Para QA visual, `node scripts/qa-workspace.cjs CAMINHO_DO_PLAYWRIGHT` usa um navegador Edge de teste e serviços simulados; não acessa contas reais.


### Resumos históricos dos relatórios
Execute `supabase/014_report_summaries.sql` após 013. A limpeza semanal salva totais por dia (America/Fortaleza), solicitante e produto/embalagem antes de excluir listas prontas há mais de 60 dias. Resumo e exclusão são atômicos. O agendamento existente é mantido. Os relatórios usam uma chamada agregada com cache de cinco minutos. Resumos não guardam observações ou detalhes individuais e não expiram automaticamente. Listas já apagadas não podem ser recuperadas. Não reexecute 013 depois de 014, pois ela substitui a função de limpeza.

## Confirmação sem marcar item a item
Execute supabase/015_confirm_without_item_state.sql após a 014 antes de publicar. Os botões Separado e Em falta foram removidos. Estoquista/admin só usam Confirmar lista pronta, que finaliza a lista e a envia ao histórico. Itens sem quantidade informada são registrados como separados por completo; quantidades parciais salvas em Quantidade separada continuam valendo e aparecem como falta.

## Tela de equipe e remoção de usuários
Execute supabase/016_remove_users.sql após a 015 antes de publicar. A tela Equipe e permissões mostra resumo (total, com acesso, aguardando/bloqueados), busca por nome ou login e filtros por situação e perfil. Cadastros sem acesso aparecem primeiro, com botão para aprovar no perfil solicitado. Cada cartão permite alterar perfil e acesso, editar nome, login e senha e remover o usuário (com confirmação). Usuário sem listas ou pedidos é excluído de vez; usuário com histórico é arquivado: perde o acesso, o login fica livre para novo cadastro e a conta é bloqueada no Supabase Auth, mas o nome continua nas listas antigas. O administrador não pode remover a própria conta.

## Aba Orçamentos
O orçamento saiu da Consulta produtos e virou a aba Orçamentos no menu. Ela tem busca própria (bipe ou digitação; bipar o mesmo produto soma a quantidade), itens com quantidade e desconto %, desconto geral em % ou R$ aplicado depois dos descontos por item, dados do cliente (nome, telefone, CPF/CNPJ), validade (sem, 3, 7, 15 ou 30 dias) e observação. O rascunho fica salvo no navegador por usuário até clicar em Novo orçamento. Na Consulta produtos, o produto consultado tem o botão Adicionar ao orçamento. A impressão/PDF mostra contato do cliente, descontos separados e data de validade. Não exige migração.

## Aba Etiquetas (ofertas)
Bipe ou busque o produto: descrição, preço e código de barras vêm da planilha. Cada etiqueta tem desconto (%), preço da oferta (exatamente o valor com desconto, sem arredondar; pode ser digitado à mão) e número de cópias. A forma de pagamento padrão vale para todas as etiquetas, e cada produto pode ter a sua (por exemplo, um item só no Pix). As formas são cadastradas pelo administrador em Configurações → Formas de pagamento; o parcelado sem juros é calculado sozinho, em até 6x com parcela mínima de R$ 30,00 (abaixo de R$ 60,00 a etiqueta mostra "À vista"). A validade vale para a folha. Impressão em A4 com margem de 5 mm: 10 × 7 cm (8 por folha), 10 × 9,5 cm (6 por folha) ou 10 × 14 cm (4 por folha), com linha tracejada de corte. O código de barras é gerado no próprio site (EAN-13, EAN-8, UPC-A ou Code 128). As etiquetas ficam salvas no navegador por usuário. Na Consulta produtos, o botão Criar etiqueta de oferta envia o produto para esta aba. Para cadastrar formas de pagamento, execute supabase/018_payment_conditions.sql após a 017 (sem ela, as etiquetas usam À vista no Pix ou dinheiro, No dinheiro, Pix ou débito e À vista).

## Relatório: estoque negativo pedido nas listas
Em Relatórios, escolha "Estoque negativo pedido nas listas". O site busca todos os itens das listas do período (respeitando solicitante, situação e as permissões do perfil) e cruza com o estoque da última leitura da planilha. Mostra os produtos com estoque negativo, a quantidade pedida, em quantas e em quais listas aparecem (número e solicitante), ordenados pelos que aparecem em mais listas e depois pelo estoque mais negativo. Tem impressão própria. Considera as listas ainda guardadas (listas prontas ficam 60 dias). Não exige migração.

## Orçamentos salvos
Execute supabase/017_saved_quotes.sql após a 016 antes de publicar (cria a tabela saved_quotes, as funções save_quote/delete_quote e a limpeza diária com pg_cron). Na aba Orçamentos, Salvar orçamento grava no banco com número sequencial; cada orçamento fica guardado até o fim da validade escolhida (Sem validade guarda 30 dias) e depois some e é apagado automaticamente. Salvar de novo atualiza o mesmo número; a validade conta sempre da data de criação. A lista Orçamentos salvos permite buscar por número, cliente, telefone ou CPF/CNPJ, abrir, duplicar como novo e excluir; avisa quando vence em até 2 dias. Cada pessoa vê os próprios orçamentos; o administrador vê todos. A impressão mostra o número e a validade a partir da criação.
Modelos de etiqueta: Clássico vermelho, Amarelo destaque (fundo branco, para imprimir em papel amarelo), Black Friday e os sazonais Natal, São João e Carnaval. O desconto aparece em destaque: selo maior e faixa "Economize R$ X" no 10 × 7 cm; bloco grande "-X% OFF" com a economia em reais nos tamanhos 10 × 9,5 e 10 × 14 cm.
