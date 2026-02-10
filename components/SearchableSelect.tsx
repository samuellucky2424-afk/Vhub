import React, { useState, useRef, useEffect } from 'react';

interface Option {
    value: string;
    label: string;
    icon?: string;
    iconUrl?: string;
    subtitle?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    selectedLabel?: string;
    label?: string;
    icon?: string;
    disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    selectedLabel,
    label,
    icon,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Initial selected option
    const selectedOption = options.find(opt => opt.value === value);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Filter options based on search
    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };

    const renderIcon = (opt?: Option, showDefault = true) => {
        if (!opt && showDefault) {
            return (
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-sm">{icon || 'check_circle'}</span>
                </div>
            );
        }
        if (opt?.iconUrl) {
            return <img src={opt.iconUrl} alt={opt.label} className="size-6 md:size-8 object-contain shrink-0" />;
        }
        if (opt?.icon) {
            return <span className="text-2xl shrink-0">{opt.icon}</span>;
        }
        return null;
    };

    return (
        <div className="relative group min-w-[200px]" ref={wrapperRef}>
            {label && (
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                    {label}
                </label>
            )}

            {/* Trigger Button */}
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-black/20 border transition-all cursor-pointer relative overflow-hidden ${isOpen ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200 dark:border-zinc-800 hover:border-primary/50'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {/* Left Icon */}
                {renderIcon(selectedOption)}

                <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate">
                        {selectedOption ? selectedOption.label : placeholder}
                    </p>
                    {(selectedOption?.subtitle || selectedLabel) && (
                        <p className="text-xs text-slate-500 truncate">{selectedOption?.subtitle || selectedLabel}</p>
                    )}
                </div>
                <span className={`material-symbols-outlined text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                </span>
            </div>

            {/* Dropdown Menu */}
            {isOpen && !disabled && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 flex flex-col animate-in fade-in zoom-in-95 duration-200 max-h-[300px]">

                    {/* Search Input Container */}
                    <div className="p-2 border-b border-slate-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full bg-slate-50 dark:bg-black/20 border-none rounded-lg pl-9 pr-3 py-2 text-sm font-medium focus:ring-2 focus:ring-primary/50 placeholder:text-slate-400 dark:text-white outline-none"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="overflow-y-auto p-1 custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <div
                                    key={opt.value}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect(opt.value);
                                    }}
                                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${value === opt.value
                                        ? 'bg-primary/10 text-primary'
                                        : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200'
                                        }`}
                                >
                                    {renderIcon(opt, false)}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${value === opt.value ? 'font-bold' : 'font-medium'} truncate`}>
                                            {opt.label}
                                        </p>
                                    </div>
                                    {value === opt.value && (
                                        <span className="material-symbols-outlined text-lg shrink-0">check</span>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-slate-400 text-sm italic">
                                No results found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
