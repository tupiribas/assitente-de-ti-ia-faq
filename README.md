## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

Melhorias:
   Melhorar Icones
   Aumentar o corpo do campo resposta na area de crair e editar o faq
   Permitir que o chat com IA interprete vídeos de passo a passo e possa usar para aprender com eles e 
   Permitir que o usuário possa importar arquivos pdfs ou de textos
   Inclui a possibilidade de ser especialista na área condominial
   Inclui botão de interromperer interação com o chat.
   Verificar a possibilidade de gerar ums área de dashboards no sistema e ranks de perguntas mais feitas ao chat incluindo o horário das perguntas.
      A base para essa pergunta tem um nível de detalhamento e nível tecnico (quanto mais detalhado maior o hanking)
      O sistema de ia deverá classificar a pergunta pelo nível de detalhamento e deve registrar isso no dashboard
      O dashboard deverá registrar o número de faqs registrados permitindo filtros
      a area de dashboard deverá ser dinâmica

Regas:
   Sempre que o usuário remover a imagem anexada no corpo do texto e/ou no anexo, deve ser removido a respectiva imagem e/ou anexo do servidor

