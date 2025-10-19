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
  FaMagic,          // Faíscas/Mágica (para SparklesIcon) - Alternativa para FaSparkles
  FaCommentDots,    // Bolha de fala (para SpeechBubbleIcon)
  FaPlusCircle,     // Círculo com mais (para PlusCircleIcon)
  FaCheckCircle,    // Círculo com check (para CheckCircleIcon)
  FaTimesCircle,    // Círculo com X (para XCircleIcon)
  FaInfoCircle,     // Círculo com informação (para InformationCircleIcon)
  FaPaperclip,      // Clipe de papel (para PaperclipIcon)
  FaBan,            // Sinal de proibido/sem (para NoImageIcon - alternativa)
  // --- NOVOS ÍCONES ---
  FaUsers as FaUserGroup,          // Ícone de grupo de usuários
  FaSignInAlt as FaLogin,          // Ícone de entrar
  FaSignOutAlt as FaLogout,        // Ícone de sair
  FaFileAlt as FaDocument          // Ícone de arquivo genérico (para DocumentIcon)
  // --- FIM NOVOS ÍCONES ---
} from 'react-icons/fa'; // Use 'react-icons/fa' ou a coleção específica instalada

// Interface para props dos ícones (se precisar passar className, etc.)
interface IconProps {
  className?: string;
  // Pode adicionar outras props como 'aria-label', 'title', etc. se necessário
}

// Re-exporte os ícones com os nomes que seus componentes esperam
export const PencilIcon: React.FC<IconProps> = ({ className }) => <FaPen className={className} />;
export const TrashIcon: React.FC<IconProps> = ({ className }) => <FaTrashAlt className={className} />;
export const ChevronDownIcon: React.FC<IconProps> = ({ className }) => <FaChevronDown className={className} />;
export const ChevronUpIcon: React.FC<IconProps> = ({ className }) => <FaChevronUp className={className} />;
export const SearchIcon: React.FC<IconProps> = ({ className }) => <FaSearch className={className} />;
export const PaperAirplaneIcon: React.FC<IconProps> = ({ className }) => <FaPaperPlane className={className} />;
export const LightBulbIcon: React.FC<IconProps> = ({ className }) => <FaLightbulb className={className} />;
export const UserCircleIcon: React.FC<IconProps> = ({ className }) => <FaUserCircle className={className} />;
export const CpuChipIcon: React.FC<IconProps> = ({ className }) => <FaMicrochip className={className} />;
export const SparklesIcon: React.FC<IconProps> = ({ className }) => <FaMagic className={className} />; // Usando FaMagic como substituto
export const SpeechBubbleIcon: React.FC<IconProps> = ({ className }) => <FaCommentDots className={className} />;
export const PlusCircleIcon: React.FC<IconProps> = ({ className }) => <FaPlusCircle className={className} />;
export const CheckCircleIcon: React.FC<IconProps> = ({ className }) => <FaCheckCircle className={className} />;
export const XCircleIcon: React.FC<IconProps> = ({ className }) => <FaTimesCircle className={className} />;
export const InformationCircleIcon: React.FC<IconProps> = ({ className }) => <FaInfoCircle className={className} />;
export const PaperclipIcon: React.FC<IconProps> = ({ className }) => <FaPaperclip className={className} />;
export const NoImageIcon: React.FC<IconProps> = ({ className }) => <FaBan className={className} />; // Usando FaBan

// --- NOVAS EXPORTAÇÕES ---
export const UserGroupIcon: React.FC<IconProps> = ({ className }) => <FaUserGroup className={className} />;
export const LoginIcon: React.FC<IconProps> = ({ className }) => <FaLogin className={className} />;
export const LogoutIcon: React.FC<IconProps> = ({ className }) => <FaLogout className={className} />;
export const DocumentIcon: React.FC<IconProps> = ({ className }) => <FaDocument className={className} />;
// --- FIM NOVAS EXPORTAÇÕES ---