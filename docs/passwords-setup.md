## Password Vault setup (Supabase)

1. Abra o Supabase SQL Editor.
2. Rode o arquivo [`supabase/passwords_vault.sql`](/c:/Users/kauaa/Documents/organize-app/supabase/passwords_vault.sql).
3. Confirme que as tabelas `vault_master` e `password_vault` foram criadas.
4. Reinicie o app (`npm run dev`) e acesse `/passwords`.
5. Crie sua senha mestra e salve uma senha de teste.

Observacao de seguranca:
- O app salva no Supabase apenas dados criptografados da senha.
- A senha mestra nao e enviada para o banco em texto puro.
