
import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-slate-800 text-slate-300 text-center p-6 mt-auto">
      <p>&copy; {currentYear} Assistente de TI IA & FAQ. Todos os direitos reservados.</p>
      <p className="text-xs mt-1">Desenvolvido com React, Tailwind CSS e Gemini API.</p>
    </footer>
  );
};

export default Footer;
