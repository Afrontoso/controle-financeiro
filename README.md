# 💰 Controle Financeiro

Uma aplicação moderna e intuitiva para gestão de finanças pessoais, focada em simplicidade e eficiência.

## 🔗 Link da Aplicação
Acesse agora: [https://controle-financeiro-lime-gamma.vercel.app/](https://controle-financeiro-lime-gamma.vercel.app/)

---

## 👤 Guia do Usuário

### ✨ Principais Funcionalidades
- **Gestão de Transações**: Registre entradas, saídas, gastos com cartão de crédito e investimentos.
- **Transações Recorrentes**: Configure repetições automáticas (diárias, semanais ou mensais) para facilitar o registro de contas fixas.
- **Visualização Flexível**: Alterne entre visão diária, de entradas, saídas, cartão ou investimentos.
- **Previsão Diária**: Entenda quanto você pode gastar por dia baseado em seu orçamento.
- **Dashboard de Economias**: Monitore seu progresso e quanto está guardando mensalmente.
- **Totais Mensais**: Resumo detalhado de performance, ganhos e evolução dos orçamentos.

### 🚀 Como Começar
1. Acesse o [Link da Aplicação](https://controle-financeiro-lime-gamma.vercel.app/).
2. Faça login com sua conta **Google** de forma segura.
3. Comece a registrar suas transações e planeje seus orçamentos mensais.

---

## 👨‍💻 Guia do Desenvolvedor

Esta aplicação foi construída utilizando as tecnologias mais modernas do ecossistema React/Next.js.

### 🛠 Stack Tecnológica
- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Linguagem**: TypeScript
- **Banco de Dados**: PostgreSQL (Hospedado no [Neon](https://neon.tech/))
- **ORM**: [Prisma](https://www.prisma.io/)
- **Autenticação**: [NextAuth.js](https://next-auth.js.org/) (Google OAuth)
- **Estilização**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Ícones**: [Lucide React](https://lucide.dev/)

### ⚙️ Rodando Localmente

1. **Clonar o Repositório**:
   ```bash
   git clone https://github.com/seu-usuario/controle-financeiro.git
   cd controle-financeiro
   ```

2. **Instalar Dependências**:
   ```bash
   npm install
   ```

3. **Configurar Variáveis de Ambiente**:
   Crie um arquivo `.env` na raiz do projeto e preencha com as seguintes chaves (use o `.env.example` se disponível):
   ```env
   DATABASE_URL="..."
   NEXTAUTH_SECRET="..."
   NEXTAUTH_URL="http://localhost:3000"
   GOOGLE_CLIENT_ID="..."
   GOOGLE_CLIENT_SECRET="..."
   ```

4. **Configurar o Banco de Dados**:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

5. **Iniciar Servidor de Desenvolvimento**:
   ```bash
   npm run dev
   ```
   Acesse: [http://localhost:3000](http://localhost:3000)

---

## 📝 Licença
Desenvolvido por **Victor Assis**. Sinta-se à vontade para entrar em contato ou reportar bugs!
