/** Shared <datalist> for inputs that suggest values but still allow free text
 *  (pair with EditableCell's `listId`). Render once per grid. */
export function OptionDatalist({ id, values }: { id: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <datalist id={id}>
      {values.map((v) => (
        <option key={v} value={v} />
      ))}
    </datalist>
  );
}
