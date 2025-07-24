import React from 'react';

// Importe os ícones do react-icons. Escolha a coleção que preferir (ex: fa, md, io, etc.)
// Para Font Awesome (fa):
import {
  FaPen,            // Lápis (para PencilIcon)
  FaTrashAlt,       // Lixeira (para TrashIcon)
  FaChevronDown,    // Seta para baixo (para ChevronDownIcon)
  FaChevronUp,      // Seta para cima (para ChevronUpIcon)
  FaSearch,         // Lupa (para SearchIcon)
  FaPaperPlane,     // Avião de papel (para PaperAirplaneIcon)
  FaLightbulb,      // Lâmpada (para LightBulbIcon)
  FaUserCircle,     // Círculo de usuário (para UserCircleIcon)
  FaMicrochip,      // Chip (para CpuChipIcon)
  FaMagic,          // Faíscas/Mágica (para SparklesIcon) - Alternativa para FaSparkles se não houver
  FaCommentDots,    // Bolha de fala (para SpeechBubbleIcon)
  FaPlusCircle,     // Círculo com mais (para PlusCircleIcon)
  FaCheckCircle,    // Círculo com check (para CheckCircleIcon)
  FaTimesCircle,    // Círculo com X (para XCircleIcon)
  FaInfoCircle,     // Círculo com informação (para InformationCircleIcon)
  FaPaperclip,      // Clipe de papel (para PaperclipIcon)
  FaBan             // Sinal de proibido/sem (para NoImageIcon - alternativa)
} from 'react-icons/fa'; // Você pode precisar instalar 'react-icons/fa' se usar npm install react-icons apenas

// Re-exporte os ícones com os nomes que seus componentes esperam
interface IconProps {
  className?: string;
}

export const PencilIcon: React.FC<IconProps> = ({ className }) => <FaPen className={className} />;
export const TrashIcon: React.FC<IconProps> = ({ className }) => <FaTrashAlt className={className} />;
export const ChevronDownIcon: React.FC<IconProps> = ({ className }) => <FaChevronDown className={className} />;
export const ChevronUpIcon: React.FC<IconProps> = ({ className }) => <FaChevronUp className={className} />;
export const SearchIcon: React.FC<IconProps> = ({ className }) => <FaSearch className={className} />;
export const PaperAirplaneIcon: React.FC<IconProps> = ({ className }) => <FaPaperPlane className={className} />;
export const LightBulbIcon: React.FC<IconProps> = ({ className }) => <FaLightbulb className={className} />;
export const UserCircleIcon: React.FC<IconProps> = ({ className }) => <FaUserCircle className={className} />;
export const CpuChipIcon: React.FC<IconProps> = ({ className }) => <FaMicrochip className={className} />;
export const SparklesIcon: React.FC<IconProps> = ({ className }) => <FaMagic className={className} />; // Use FaMagic ou encontre outro similar
export const SpeechBubbleIcon: React.FC<IconProps> = ({ className }) => <FaCommentDots className={className} />;
export const PlusCircleIcon: React.FC<IconProps> = ({ className }) => <FaPlusCircle className={className} />;
export const CheckCircleIcon: React.FC<IconProps> = ({ className }) => <FaCheckCircle className={className} />;
export const XCircleIcon: React.FC<IconProps> = ({ className }) => <FaTimesCircle className={className} />;
export const InformationCircleIcon: React.FC<IconProps> = ({ className }) => <FaInfoCircle className={className} />;
export const PaperclipIcon: React.FC<IconProps> = ({ className }) => <FaPaperclip className={className} />;

// Para NoImageIcon, você pode escolher um ícone que represente "nada" ou "proibido"
// Ou manter o SVG original se preferir (remova a importação FaBan e a linha export abaixo se mantiver o SVG)
export const NoImageIcon: React.FC<IconProps> = ({ className }) => <FaBan className={className} />;