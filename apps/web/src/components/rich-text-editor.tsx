import { Color, TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { isRichTextHtml, plainTextToHtml } from "./rich-text-utils";

// Feste Farbauswahl statt freiem Farbwähler — bleibt im Markenbild
const COLORS = [
  { label: "Orange", value: "#e85b2c" },
  { label: "Blau", value: "#2752f0" },
  { label: "Rot", value: "#d92d20" },
];

interface Props {
  id?: string;
  value: string;
  onChange: (html: string) => void;
}

// Editor für Event-Beschreibungen: fett, kursiv, unterstrichen, Farbe, Listen mit Einrückung.
// Speichert HTML; reiner Alt-Text wird beim Laden in Absätze übersetzt.
export function RichTextEditor({ id, value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        link: false,
      }),
      TextStyle,
      Color,
    ],
    content: isRichTextHtml(value) ? value : plainTextToHtml(value),
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { ...(id ? { id } : {}), class: "rich-text rich-text-editor-content" },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? "" : ed.getHTML()),
  });

  // Von außen gesetzten Inhalt übernehmen (z. B. Vorbefüllung aus einer Event-Anfrage).
  // Eigene Eingaben kommen über onUpdate identisch zurück und lösen hier nichts aus.
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value === current) return;
    editor.commands.setContent(isRichTextHtml(value) ? value : plainTextToHtml(value), {
      emitUpdate: false,
    });
  }, [editor, value]);

  if (!editor) return null;

  const inList = editor.isActive("bulletList") || editor.isActive("orderedList");
  const tools: {
    label: string;
    title: string;
    active: boolean;
    disabled?: boolean;
    run: () => void;
  }[] = [
    {
      label: "B",
      title: "Fett (Strg+B)",
      active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "I",
      title: "Kursiv (Strg+I)",
      active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "U",
      title: "Unterstrichen (Strg+U)",
      active: editor.isActive("underline"),
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: "• Liste",
      title: "Stichpunkte",
      active: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "1. Liste",
      title: "Nummerierte Liste",
      active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "→",
      title: "Einrücken (Tab)",
      active: false,
      disabled: !inList || !editor.can().sinkListItem("listItem"),
      run: () => editor.chain().focus().sinkListItem("listItem").run(),
    },
    {
      label: "←",
      title: "Ausrücken (Umschalt+Tab)",
      active: false,
      disabled: !inList,
      run: () => editor.chain().focus().liftListItem("listItem").run(),
    },
  ];

  return (
    <div className="rich-text-editor">
      <div className="rich-text-toolbar" role="toolbar" aria-label="Formatierung">
        {tools.map((tool) => (
          <button
            key={tool.title}
            type="button"
            className={tool.active ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
            title={tool.title}
            aria-pressed={tool.active}
            disabled={tool.disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={tool.run}
            style={{
              fontWeight: tool.label === "B" ? 700 : undefined,
              fontStyle: tool.label === "I" ? "italic" : undefined,
              textDecoration: tool.label === "U" ? "underline" : undefined,
            }}
          >
            {tool.label}
          </button>
        ))}
        <span className="rich-text-toolbar-sep" />
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            className="rich-text-color"
            title={`Textfarbe ${c.label}`}
            aria-label={`Textfarbe ${c.label}`}
            aria-pressed={editor.isActive("textStyle", { color: c.value })}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().setColor(c.value).run()}
            style={{ background: c.value }}
          />
        ))}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          title="Farbe entfernen"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().unsetColor().run()}
        >
          A̶
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
