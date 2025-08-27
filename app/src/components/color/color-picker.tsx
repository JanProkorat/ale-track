import {useTranslation} from "react-i18next";
import {HexColorPicker} from "react-colorful";
import React, {useRef, useState} from "react";

import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import {FormControl, OutlinedInput, FormHelperText, InputAdornment} from "@mui/material";

import {Iconify} from "../iconify";

interface ColorPickerProps {
    color: string;
    errors: Record<string, string>;
    onChange: (color: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({color, errors, onChange}) => {
    const {t} = useTranslation();
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    const inputRef = useRef<HTMLElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    const handleInputFocus = () => {
        if (inputRef.current) {
            setAnchorEl(inputRef.current);
        }
    }

    const handlePopoverClose = () => {
        if (anchorEl !== null)
            setAnchorEl(null);
    };

    return (
        <>
            <FormControl fullWidth error={!!errors.color}>
                <OutlinedInput
                    inputRef={inputRef}
                    value={color}
                    onFocus={handleInputFocus}
                    placeholder={t('drivers.color')}
                    endAdornment={
                        <InputAdornment position="start">
                            <Iconify width={20} icon="solar:pen-bold" sx={{color: 'text.disabled'}}/>
                        </InputAdornment>
                    }
                />
                {errors.color && <FormHelperText>{errors.color}</FormHelperText>}
            </FormControl>

            <Popover
                sx={{ p: 2 }}
                tabIndex={0}
                onBlur={(e) => {
                    if (!popoverRef.current?.contains(e.relatedTarget as Node)) {
                        setAnchorEl(null);
                    }
                }}
                open={anchorEl !== null}
                anchorEl={anchorEl}
                onClose={handlePopoverClose}
                anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
                disableRestoreFocus
                slotProps={{
                    paper: {
                        ref: popoverRef
                    }
                }}
            >
                    <Box sx={{p: 2}}>
                        <HexColorPicker
                            color={color ?? ''}
                            onChange={newColor => onChange(newColor)}
                        />
                    </Box>
            </Popover>
        </>
    );
};