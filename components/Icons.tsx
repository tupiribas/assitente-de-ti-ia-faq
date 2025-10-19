import React from 'react';
// Importando ícones da Font Awesome (fa)
import {
  FaPen, FaTrashAlt, FaChevronDown, FaChevronUp, FaSearch,
  FaPaperPlane, FaLightbulb, FaUserCircle, FaMicrochip, FaMagic,
  FaCommentDots, FaPlusCircle, FaCheckCircle, FaTimesCircle, FaInfoCircle,
  FaPaperclip, FaBan,
  // Ícones adicionados para Auth/Admin
  FaUsers as FaUserGroup,      // Para UserGroupIcon
  FaSignInAlt as FaLogin,      // Para LoginIcon
  FaSignOutAlt as FaLogout,    // Para LogoutIcon
  FaFileAlt as FaDocument      // Para DocumentIcon (ícone genérico de ficheiro)
} from 'react-icons/fa';

// Interface para props (opcional, mas boa prática)
interface IconProps {
  className?: string;
}

// Exportações existentes
export const PencilIcon: React.FC<IconProps> = ({ className }) => <FaPen className={className} />;
export const TrashIcon: React.FC<IconProps> = ({ className }) => <FaTrashAlt className={className} />;
export const ChevronDownIcon: React.FC<IconProps> = ({ className }) => <FaChevronDown className={className} />;
export const ChevronUpIcon: React.FC<IconProps> = ({ className }) => <FaChevronUp className={className} />;
export const SearchIcon: React.FC<IconProps> = ({ className }) => <FaSearch className={className} />;
export const PaperAirplaneIcon: React.FC<IconProps> = ({ className }) => <FaPaperPlane className={className} />;
export const LightBulbIcon: React.FC<IconProps> = ({ className }) => <FaLightbulb className={className} />;
export const UserCircleIcon: React.FC<IconProps> = ({ className }) => <FaUserCircle className={className} />;
export const CpuChipIcon: React.FC<IconProps> = ({ className }) => <FaMicrochip className={className} />;
export const SparklesIcon: React.FC<IconProps> = ({ className }) => <FaMagic className={className} />;
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