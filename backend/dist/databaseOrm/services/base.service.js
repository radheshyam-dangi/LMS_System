"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseService = void 0;
class BaseService {
    async findAll() {
        return await this.repository.find();
    }
    async findOne(id) {
        return await this.repository.findOneBy({ id });
    }
    async create(data) {
        return await this.repository.save(data);
    }
    async update(id, data) {
        await this.repository.update(id, data);
        return this.findOne(id);
    }
    async remove(id) {
        return await this.repository.delete(id);
    }
}
exports.BaseService = BaseService;
//# sourceMappingURL=base.service.js.map