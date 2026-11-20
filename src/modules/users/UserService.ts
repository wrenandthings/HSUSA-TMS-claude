export class UserService {
    async getUsers() {
        return await window.hsusa.getUsers();
    }

    async getUserById(userId: string) {
        return await window.hsusa.getUserById(userId);
    }

    async createUser(user: {
        username: string;
        password: string;
        firstName: string;
        lastName: string;
        email: string;
        status: "ACTIVE" | "INACTIVE" | "LOCKED";
    }) {
        return await window.hsusa.createUser(user);
    }

    async updateUser(user: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        email: string;
        status: "ACTIVE" | "INACTIVE" | "LOCKED";
    }) {
        return await window.hsusa.updateUser(user);
    }

    async deleteUser(userId: string) {
        return await window.hsusa.deleteUser(userId);
    }

    async getRoles() {
        return await window.hsusa.getRoles();
    }

    async addRole(userId: string, roleId: string) {
        return await window.hsusa.addUserRole({ userId, roleId });
    }

    async removeRole(userId: string, roleId: string) {
        return await window.hsusa.removeUserRole({ userId, roleId });
    }

    async changePassword(userId: string, password: string) {
        return await window.hsusa.changeUserPassword({ userId, password });
    }
}
