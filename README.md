# Projeto D Autenticador

Site responsivo/PWA para login de convidados, resgate de códigos de ingresso, emissão de QR Code e validação de entrada pelo administrador.

## Arquivos

- `index.html`: interface e estrutura.
- `styles.css`: visual preto com neon vermelho e tipografia futurista.
- `app.js`: autenticação, ingressos, QR Code e scanner.
- `config.js`: conexão pública do Supabase.
- `manifest.json` e `sw.js`: recursos PWA.
- `assets/logo.png`: logo usada pelo site.

## 1. Configurar Supabase

Abra `config.js` e substitua:

- `COLE_AQUI_A_PROJECT_URL` pela Project URL do seu projeto Supabase.
- `COLE_AQUI_A_CHAVE_PUBLICA` pela Publishable key (`sb_publishable_...`) ou chave legada `anon`.

**Nunca coloque uma `service_role` ou chave `secret` no frontend.** A URL e a chave pública são utilizadas pelo navegador; a segurança depende das permissões do banco e das funções.

As funções SQL necessárias devem existir no projeto Supabase:
- `my_profile()`
- `my_ticket()`
- `claim_ticket(p_code text)`
- `create_ticket(p_guest_name text)`
- `admin_ticket_list()`
- `redeem_ticket(p_ticket_id uuid, p_qr_token uuid)`

Essas funções foram configuradas em etapas anteriores. Antes de produção, faça a revisão de segurança descrita abaixo.

## 2. Enviar ao GitHub

1. Extraia o ZIP no computador.
2. Abra o repositório GitHub.
3. Use **Add file → Upload files**.
4. Envie o conteúdo da pasta `projeto-d-autenticador`, incluindo a pasta `assets`.
5. Faça **Commit changes**.

Os arquivos precisam ficar na raiz do repositório. Evite deixar tudo dentro de uma segunda pasta `projeto-d-autenticador/projeto-d-autenticador/`.

## 3. Hospedagem

Pode usar Cloudflare Pages conectado ao repositório GitHub:
- Framework preset: `None`
- Build command: deixe vazio
- Build output directory: `/` ou `.` conforme a interface
- Publique em HTTPS. A leitura de câmera exige contexto seguro (HTTPS ou localhost).

Também é possível servir os arquivos localmente para desenvolvimento, mas a câmera não funcionará em uma página HTTP comum de rede.

## 4. Configuração de e-mail

Se a confirmação de e-mail estiver ativa no Supabase, o convidado deverá confirmar o endereço antes de entrar. Configure a URL do site e os Redirect URLs em **Authentication → URL Configuration** no Supabase.

## 5. Segurança obrigatória antes de usar em evento real

- Adicione rate limiting ao resgate de códigos de 9 dígitos, preferencialmente com uma função Edge ou mecanismo no servidor, com limites por usuário/IP e atrasos progressivos.
- Troque a geração de códigos baseada em `random()` por gerador criptograficamente seguro.
- Configure proteção contra abuso/brute force e monitore tentativas.
- Teste que apenas o único UID administrativo designado pode criar ingressos e validar QR Codes.
- Faça testes concorrentes de validação: somente uma chamada deve retornar `AUTHORIZED`; a seguinte deve retornar `ALREADY_USED`.
- Use senha forte e autenticação multifator na conta administrativa, se possível.
- Não use dados reais de convidados antes de concluir os testes.

O QR Code não contém dados pessoais completos; ele guarda o ID do ingresso e o token aleatório, e a validação é feita no banco.

## Observações

- O scanner precisa de permissão de câmera.
- Bibliotecas de Supabase, QR Code e scanner são carregadas por CDN, portanto a conexão à internet é necessária.
- A logo incluída é a imagem fornecida na conversa. Se ela tiver fundo opaco, prepare uma versão PNG com transparência real para melhor resultado sobre o fundo preto.
