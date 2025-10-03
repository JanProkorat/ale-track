import type { CreateClientContactDto, UpdateClientContactDto } from "../api/Client";

type ContactDto = CreateClientContactDto | UpdateClientContactDto;

export type ContactValidationErrors = { [contactIndex: number]: { type?: boolean; value?: boolean } };

export function validateContacts(contacts: ContactDto[] | undefined): {
    validationErrors: ContactValidationErrors;
    hasErrors: boolean;
} {
    const validationErrors: ContactValidationErrors = {};
    let hasErrors = false;

    if (!contacts || contacts.length === 0) {
        return { validationErrors, hasErrors };
    }

    contacts.forEach((contact, index) => {
        const contactErrors: { type?: boolean; value?: boolean } = {};

        if (contact.type === undefined || contact.type === null) {
            contactErrors.type = true;
            hasErrors = true;
        }
        if (!contact.value || contact.value.trim() === '') {
            contactErrors.value = true;
            hasErrors = true;
        }

        if (contactErrors.type || contactErrors.value) {
            validationErrors[index] = contactErrors;
        }
    });

    return { validationErrors, hasErrors };
}
