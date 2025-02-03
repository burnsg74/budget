import React, { useState } from "react";

interface EditableFieldProps<T> {
    label: string;
    value: T;
    type?: "text" | "number";
    formatter?: (value: T) => string;
    onSave: (newValue: T) => void;
}

const EditableField = <T extends string | number>({
                                                      label,
                                                      value,
                                                      type = "text",
                                                      formatter,
                                                      onSave,
                                                  }: EditableFieldProps<T>) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState<T>(value);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            onSave(tempValue);
            setIsEditing(false);
        } else if (e.key === "Escape") {
            setTempValue(value);
            setIsEditing(false);
        }
    };

    const handleBlur = () => {
        setIsEditing(false);
        setTempValue(value);
    };

    return (
        <div>
            <strong>{label}</strong>
            {isEditing ? (
                <input
                    type={type}
                    value={tempValue as string | number}
                    autoFocus
                    onChange={(e) =>
                        setTempValue(type === "number" ? (Number(e.target.value) as T) : (e.target.value as T))
                    }
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                />
            ) : (
                <span onDoubleClick={() => setIsEditing(true)}>
          {formatter ? formatter(value) : value}
        </span>
            )}
        </div>
    );
};

export default EditableField;