export interface MentionState {
  isActive: boolean;
  query: string;
  selectedIndex: number;
  position: {
    top: number;
    left: number;
    width: number;
  } | null;
}

export interface DetachableWindowProps {
  messages: EnrichedMessage[];
  onClose: () => void;
  onSendMessage: (message: string) => void;
  currentUserName?: string;
}

export interface EnrichedMessage {
  message: string;
  messageType: {
    isQuestion: boolean;
    isMention: boolean;
    isModeratorMessage: boolean;
  };
  sender: {
    id: string;
    name: string;
    role: string;
    avatar: string;
    avatarColor: string;
    avatarTextColor: string;
    isOnline: boolean;
  };
  timestamp: {
    raw: string;
    formatted: string;
  };
  styles: {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
  };
}
