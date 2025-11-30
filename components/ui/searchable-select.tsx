"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export interface SearchableSelectOption {
    value: string
    label: string
    keywords?: string[]
}

interface SearchableSelectProps {
    options: SearchableSelectOption[]
    value: string
    onValueChange: (value: string) => void
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    className?: string
    disabled?: boolean
}

export function SearchableSelect({
    options,
    value,
    onValueChange,
    placeholder = "Select an option...",
    searchPlaceholder = "Search...",
    emptyText = "No results found.",
    className,
    disabled = false,
}: SearchableSelectProps) {
    const [open, setOpen] = React.useState(false)

    const selectedOption = options.find((option) => option.value === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "w-full justify-between",
                        !value && "text-muted-foreground",
                        className
                    )}
                    disabled={disabled}
                >
                    <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    keywords={option.keywords || [option.label]}
                                    onSelect={() => {
                                        onValueChange(option.value)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span className="truncate">{option.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
