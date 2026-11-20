export class SubjectService {

    async getSubjects() {

        return await window.hsusa.getSubjects();
    }

    async getSubjectById(
        subjectId: string
    ) {

        return await window.hsusa.getSubjectById(
            subjectId
        );
    }

    async createSubject(
        code: string,
        subjectName: string,
        description: string
    ) {

        return await window.hsusa.createSubject({
            code,
            subjectName,
            description
        });
    }

    async updateSubject(
        id: string,
        code: string,
        subjectName: string,
        description: string
    ) {

        return await window.hsusa.updateSubject({
            id,
            code,
            subjectName,
            description
        });
    }

    async deleteSubject(
        subjectId: string
    ) {

        return await window.hsusa.deleteSubject(
            subjectId
        );
    }
    
}