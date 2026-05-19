import type { FC } from 'react';
import {
  Bs123,
  BsCalendar3,
  BsCheckSquare,
  BsInputCursorText,
  BsMenuButtonWide,
  BsPaperclip,
  BsRecordCircle,
  BsTextareaResize,
} from 'react-icons/bs';
import type { IconType } from 'react-icons';
import type { FieldConfig } from '../../types/schema';

interface FieldPaletteProps {
  onAddField: (type: FieldConfig['type']) => void;
}

const FIELD_TYPES: Array<{
  type: FieldConfig['type'];
  label: string;
  icon: IconType;
}> = [
  { type: 'text', label: 'Text Input', icon: BsInputCursorText },
  { type: 'number', label: 'Number', icon: Bs123 },
  { type: 'select', label: 'Select', icon: BsMenuButtonWide },
  { type: 'checkbox', label: 'Checkbox', icon: BsCheckSquare },
  { type: 'radio', label: 'Radio', icon: BsRecordCircle },
  { type: 'date', label: 'Date', icon: BsCalendar3 },
  { type: 'textarea', label: 'Textarea', icon: BsTextareaResize },
  { type: 'file', label: 'File Upload', icon: BsPaperclip },
];

export const FieldPalette: FC<FieldPaletteProps> = ({ onAddField }) => {
  return (
    <aside className="helix-field-palette">
      <h3>Field Palette</h3>
      <div className="helix-palette-items">
        {FIELD_TYPES.map((field) => {
          const Icon = field.icon;

          return (
          <button
            key={field.type}
            type="button"
            className="helix-palette-item"
            onClick={() => onAddField(field.type)}
          >
            <span className="helix-palette-icon" aria-hidden="true">
              <Icon />
            </span>
            <span>{field.label}</span>
          </button>
          );
        })}
      </div>
    </aside>
  );
};
