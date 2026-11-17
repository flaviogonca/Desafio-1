import { ForbiddenError, NotFoundError, ValidationError } from '../../../shared/domain/errors';
import { CreateServiceUseCase } from './create-service.use-case';
import { DeleteServiceUseCase } from './delete-service.use-case';
import { ListServicesUseCase } from './list-services.use-case';
import { InMemoryServiceRepository } from './test-doubles';
import { UpdateServiceUseCase } from './update-service.use-case';

describe('Service use cases', () => {
  let repo: InMemoryServiceRepository;
  let create: CreateServiceUseCase;
  let update: UpdateServiceUseCase;
  let remove: DeleteServiceUseCase;
  let list: ListServicesUseCase;

  const base = { name: 'Cleaning', description: 'Full cleaning', price: 5000 };

  beforeEach(() => {
    repo = new InMemoryServiceRepository();
    create = new CreateServiceUseCase(repo);
    update = new UpdateServiceUseCase(repo);
    remove = new DeleteServiceUseCase(repo);
    list = new ListServicesUseCase(repo);
  });

  describe('create', () => {
    it('creates a service owned by the given provider', async () => {
      const service = await create.execute({ ...base, providerId: 'p1' });
      expect(service).toMatchObject({ name: 'Cleaning', price: 5000, providerId: 'p1' });
    });

    it.each([0, -1, 1.5, Number.NaN])('rejects price %p (boundary: must be an integer > 0)', (price) => {
      expect(() => create.execute({ ...base, price, providerId: 'p1' })).toThrow(ValidationError);
    });

    it('accepts the smallest valid price (1)', async () => {
      await expect(create.execute({ ...base, price: 1, providerId: 'p1' })).resolves.toMatchObject({ price: 1 });
    });
  });

  describe('update', () => {
    it('lets the owner change the service', async () => {
      const { id } = await create.execute({ ...base, providerId: 'p1' });
      const updated = await update.execute({ serviceId: id, actorId: 'p1', patch: { price: 9000 } });
      expect(updated.price).toBe(9000);
    });

    it("forbids another provider from changing someone else's service", async () => {
      const { id } = await create.execute({ ...base, providerId: 'p1' });
      await expect(update.execute({ serviceId: id, actorId: 'p2', patch: { price: 1 } })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(repo.items[0].price).toBe(5000); // unchanged
    });

    it('returns not found for an unknown or deleted service', async () => {
      await expect(update.execute({ serviceId: 'nope', actorId: 'p1', patch: { price: 1 } })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('rejects an empty patch and an invalid price', async () => {
      const { id } = await create.execute({ ...base, providerId: 'p1' });
      await expect(update.execute({ serviceId: id, actorId: 'p1', patch: {} })).rejects.toBeInstanceOf(ValidationError);
      await expect(update.execute({ serviceId: id, actorId: 'p1', patch: { price: 0 } })).rejects.toBeInstanceOf(
        ValidationError,
      );
    });
  });

  describe('delete', () => {
    it('soft-deletes for the owner and hides the service from lists', async () => {
      const { id } = await create.execute({ ...base, providerId: 'p1' });
      await remove.execute({ serviceId: id, actorId: 'p1' });

      expect(repo.items).toHaveLength(1); // row kept (history stays intact)
      expect((await list.all(1, 20)).total).toBe(0);
    });

    it("forbids deleting another provider's service and cannot delete twice", async () => {
      const { id } = await create.execute({ ...base, providerId: 'p1' });
      await expect(remove.execute({ serviceId: id, actorId: 'p2' })).rejects.toBeInstanceOf(ForbiddenError);
      await remove.execute({ serviceId: id, actorId: 'p1' });
      await expect(remove.execute({ serviceId: id, actorId: 'p1' })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('list', () => {
    it('"mine" returns only the provider\'s services, with pagination metadata', async () => {
      await create.execute({ ...base, providerId: 'p1' });
      await create.execute({ ...base, providerId: 'p1' });
      await create.execute({ ...base, providerId: 'p2' });

      const mine = await list.mine('p1', 1, 1);
      expect(mine).toMatchObject({ total: 2, page: 1, limit: 1 });
      expect(mine.items).toHaveLength(1);
      expect((await list.all(1, 20)).total).toBe(3);
    });
  });
});
