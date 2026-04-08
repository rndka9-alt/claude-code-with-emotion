import { useEffect, useRef, useState } from "react";

export interface TabTitleEditorState {
  draftTitle: string;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  editingTabId: string | null;
  finishRenaming: (tabId: string) => void;
  setDraftTitle: (title: string) => void;
  setEditingTabId: (tabId: string | null) => void;
  startRenaming: (tabId: string, title: string) => void;
}

export function useTabTitleEditor(
  onRenameTab: (tabId: string, title: string) => void,
): TabTitleEditorState {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingTabId !== null) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingTabId]);

  return {
    draftTitle,
    editInputRef,
    editingTabId,
    finishRenaming: (tabId) => {
      onRenameTab(tabId, draftTitle);
      setEditingTabId(null);
    },
    setDraftTitle,
    setEditingTabId,
    startRenaming: (tabId, title) => {
      setEditingTabId(tabId);
      setDraftTitle(title);
    },
  };
}
