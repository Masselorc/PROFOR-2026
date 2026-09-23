# Banco do PROFOR 2026

O servidor guarda o banco em `registros/`, dentro desta pasta. Cada arquivo JSON é uma versão completa e imutável do estado, ligada à versão anterior. Todos os registros fazem parte do banco: não apagar versões antigas nem editar os arquivos manualmente.

Marque a pasta do sistema como **Sempre manter neste dispositivo** no OneDrive. Feche o sistema e espere o OneDrive terminar de enviar antes de mudar de computador; no outro computador espere terminar de baixar antes de abrir `INICIAR SISTEMA.cmd`. O Node.js precisa estar instalado nas duas máquinas.

Se duas máquinas gravarem sem sincronizar, as duas versões ficam preservadas e o sistema bloqueia o uso quando detectar a divergência. O OneDrive transporta arquivos; não coordena edição simultânea. A reconciliação exige comparar os registros antes de escolher ou combinar as alterações.

No primeiro acesso, se ainda não houver registros, o sistema copia automaticamente o IndexedDB do navegador e endereço usados naquele acesso. A cópia antiga é preservada. Bancos de outro perfil/máquina/endereço não são descobertos automaticamente: exporte o backup naquele ambiente e restaure no sistema. Em Backup e exportação há também a opção de resgatar o banco antigo do navegador atual.

O cache de extrações em `.cache/` não substitui este banco: não contém as análises do usuário. O aplicativo confirma gravação local; não verifica se o OneDrive já enviou os arquivos à nuvem.
