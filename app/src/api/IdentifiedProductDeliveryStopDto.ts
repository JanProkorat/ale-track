import { v4 as uuidv4 } from 'uuid';

import {
    CreateProductDeliveryItemDto,
    CreateProductDeliveryStopDto
} from "./Client";

import type { ICreateProductDeliveryStopDto,
    ICreateProductDeliveryItemDto
} from "./Client";

export class IdentifiedProductDeliveryStopDto extends CreateProductDeliveryStopDto {
    id: string;
    products?: IdentifiedProductDeliveryItemDto[];

    constructor(data?: ICreateProductDeliveryStopDto & { id?: string }) {
        super(data);
        this.id = data?.id ?? uuidv4();

        if (data?.products) {
            this.products = data.products.map(
                (p) => new IdentifiedProductDeliveryItemDto(p)
            );
        }
    }

    override init(_data?: any) {
        super.init(_data);
        this.id = _data["id"] ?? uuidv4();

        if (Array.isArray(_data["products"])) {
            this.products = _data["products"].map((p: any) =>
                IdentifiedProductDeliveryItemDto.fromJS(p)
            );
        }
    }

    override toJSON(data?: any) {
        data = super.toJSON(data);
        data["id"] = this.id;
        if (Array.isArray(this.products)) {
            data["products"] = this.products.map(p => p.toJSON());
        }
        return data;
    }

    static override fromJS(data: any): IdentifiedProductDeliveryStopDto {
        data = typeof data === 'object' ? data : {};
        const result = new IdentifiedProductDeliveryStopDto();
        result.init(data);
        return result;
    }
}

export class IdentifiedProductDeliveryItemDto extends CreateProductDeliveryItemDto {
    id: string;

    constructor(data?: ICreateProductDeliveryItemDto & { id?: string }) {
        super(data);
        this.id = data?.id ?? uuidv4();
    }

    override init(_data?: any) {
        super.init(_data);
        this.id = _data["id"] ?? uuidv4();
    }

    override toJSON(data?: any) {
        data = super.toJSON(data);
        data["id"] = this.id;
        return data;
    }

    static override fromJS(data: any): IdentifiedProductDeliveryItemDto {
        data = typeof data === 'object' ? data : {};
        const result = new IdentifiedProductDeliveryItemDto();
        result.init(data);
        return result;
    }
}

