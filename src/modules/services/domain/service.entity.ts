/** Price is an integer in the smallest currency unit (cents). */
export interface ServiceView {
  id: string;
  name: string;
  description: string;
  price: number;
  providerId: string;
  provider: { id: string; fullName: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface NewService {
  name: string;
  description: string;
  price: number;
  providerId: string;
}

export type ServicePatch = Partial<Pick<NewService, 'name' | 'description' | 'price'>>;
