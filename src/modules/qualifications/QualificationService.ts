export type QualificationStatus = "CURRENT" | "EXPIRING" | "EXPIRING_CRITICAL" | "EXPIRED" | "SUSPENDED";
export type AssignmentStatus = "ACTIVE" | "COMPLETED" | "REVOKED";

// A catalog entry such as PIC. renewalMonths empty means it does not expire.
export type QualificationInput = { code: string; name: string; description: string; renewalMonths: string; active: boolean };

export type AssignmentUser = { id: string; username: string; firstName?: string; lastName?: string };

// One person's assignment. Dates and suspension belong to the person.
// qualificationStatus is calculated by the main process from expirationDate.
export type Assignment = {
    id: string;
    userId: string;
    qualificationId: string;
    status: AssignmentStatus;
    assignedAt: string | Date;
    awardedDate?: string | Date | null;
    expirationDate?: string | Date | null;
    suspended: boolean;
    revokedAt?: string | Date | null;
    completedAt?: string | Date | null;
    endReason?: string | null;
    qualificationStatus: QualificationStatus;
    user: AssignmentUser;
};

export type Qualification = {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    renewalMonths?: number | null;
    active: boolean;
    hidden?: boolean;
    assignments: Assignment[];
};

export type AssignInput = { qualificationId: string; userId: string; awardedDate?: string; expirationDate?: string };
export type AssignmentUpdate = { assignmentId: string; awardedDate?: string | null; expirationDate?: string | null; suspended?: boolean };
export type Result = { success: boolean; message?: string };

export class QualificationService {
    async getQualifications(options?: { includeHidden?: boolean }): Promise<Qualification[]> { return window.hsusa.getQualifications(options); }
    async setHidden(id: string, hidden: boolean): Promise<Result> { return window.hsusa.setQualificationHidden({ id, hidden }); }
    async getQualificationById(id: string): Promise<Qualification | null> { return window.hsusa.getQualificationById(id); }
    async createQualification(input: QualificationInput): Promise<Result> { return window.hsusa.createQualification(input); }
    async updateQualification(input: QualificationInput & { id: string }): Promise<Result> { return window.hsusa.updateQualification(input); }
    async deleteQualification(id: string): Promise<Result> { return window.hsusa.deleteQualification(id); }
    async assignUser(input: AssignInput): Promise<Result> { return window.hsusa.assignQualificationUser(input); }
    async updateAssignment(input: AssignmentUpdate): Promise<Result> { return window.hsusa.updateQualificationAssignment(input); }
    async unassignUser(qualificationId: string, userId: string, reason?: string): Promise<Result> {
        return window.hsusa.unassignQualificationUser({ qualificationId, userId, reason });
    }
}

// The user's active assignment of a qualification, if any.
export function activeAssignmentFor(qualification: Qualification, userId: string): Assignment | undefined {
    return qualification.assignments?.find(a => a.user?.id === userId && a.status === "ACTIVE");
}
