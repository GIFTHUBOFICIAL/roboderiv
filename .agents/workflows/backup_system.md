---
description: Realiza backup completo do sistema Deriv para a pasta backup
---
Este workflow copia os arquivos principais (index.html, app.js, style.css) e a pasta src para um diretório com data e hora dentro da pasta backup.

// turbo
1. Executar o comando de backup:
```bash
mkdir -p /home/agenciaseogo/Deriv/backup/$(date +%Y%m%d_%H%M%S) && cp -r /home/agenciaseogo/Deriv/index.html /home/agenciaseogo/Deriv/app.js /home/agenciaseogo/Deriv/style.css /home/agenciaseogo/Deriv/src /home/agenciaseogo/Deriv/backup/$(date +%Y%m%d_%H%M%S)/
```
