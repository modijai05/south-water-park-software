import { useState } from 'react';
import { motion } from 'framer-motion';

interface InlineEditableFieldProps {
  value: string | number;
  onChange: (value: string | number) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  label?: string;
  icon?: string;
}

export function InlineEditableField({ 
  value, 
  onChange, 
  type = 'text', 
  placeholder = '', 
  className = '',
  disabled = false,
  label = '',
  icon = ''
}: InlineEditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());

  const handleDoubleClick = () => {
    if (!disabled) {
      setIsEditing(true);
      setEditValue(value.toString());
    }
  };

  const handleSave = () => {
    const newValue = type === 'number' ? parseFloat(editValue) || 0 : editValue;
    onChange(newValue);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value.toString());
    }
  };

  const handleBlur = () => {
    if (isEditing) {
      handleSave();
    }
  };

  return (
    <div className={`relative group ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {icon && <span className="mr-1">{icon}</span>}
          {label}
        </label>
      )}
      <div 
        className={`
          relative px-3 py-2 rounded-lg border-2 transition-all duration-200
          ${isEditing ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}
        `}
        onDoubleClick={handleDoubleClick}
        title={disabled ? 'Field is disabled' : 'Double-click to edit'}
      >
        {isEditing ? (
          <input
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="w-full bg-transparent outline-none text-gray-900"
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-gray-900 font-medium">
              {value}
            </span>
            {!disabled && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 0L9 12.536V3a2 2 0 012-2h4a2 2 0 012 2v9.536l3.732 3.732a2.5 2.5 0 11-3.536 0z" />
                </svg>
              </motion.div>
            )}
          </div>
        )}
      </div>
      {!disabled && !isEditing && (
        <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            Double-click to edit
          </div>
        </div>
      )}
    </div>
  );
}
