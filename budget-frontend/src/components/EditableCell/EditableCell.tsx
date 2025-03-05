import React, { useState, useEffect } from "react";

interface EditableFieldProps<T> {
    label: string;
    value: T;
    type?: "text" | "number" | "select" | "checkbox";
    options?: T[]; // For select dropdown, an array of options
    formatter?: (value: T) => string;
    onSave: (newValue: T) => void;
}

const EditableField = <T extends string | number | boolean>({
                                                                label,
                                                                value,
                                                                type = "text",
                                                                options,
                                                                formatter,
                                                                onSave,
                                                            }: EditableFieldProps<T>) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState<T>(value);

    useEffect(() => {
        setTempValue(value);
    }, [value]);


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

    const handleSave = (newValue: T) => {
        onSave(newValue);
        setIsEditing(false);
    };

    return (
        <div>
            <strong>{label} </strong>
            {isEditing ? (
                type === "select" && options ? (
                    <select
                        value={tempValue as string}
                        onChange={(e) => setTempValue(e.target.value as T)}
                        onBlur={() => handleSave(tempValue)}
                        autoFocus
                    >
                        {options.map((option, index) => (
                            <option key={index} value={option as string}>
                                {option}
                            </option>
                        ))}
                    </select>
                ) : type === "checkbox" ? (
                    <input
                        type="checkbox"
                        checked={tempValue as boolean}
                        onChange={(e) => handleSave(e.target.checked as T)}
                        autoFocus
                    />
                ) : (
                    <input
                        type={type}
                        value={tempValue as string | number}
                        autoFocus
                        onChange={(e) =>
                            setTempValue(
                                type === "number"
                                    ? (Number(e.target.value) as T)
                                    : (e.target.value as T)
                            )
                        }
                        onKeyDown={handleKeyDown}
                        onBlur={handleBlur}
                    />
                )
            ) : (
                <span onDoubleClick={() => setIsEditing(true)}>
                    {formatter ? formatter(value) : String(value)}
                </span>
            )}
        </div>
    );
};

export default EditableField;