export namespace main {
	
	export class CreateGoalInput {
	    title: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateGoalInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.description = source["description"];
	    }
	}
	export class CreateInitiativeInput {
	    goalId: string;
	    title: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateInitiativeInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.goalId = source["goalId"];
	        this.title = source["title"];
	        this.description = source["description"];
	    }
	}
	export class CreateKPIInput {
	    goalId: string;
	    initiativeId: string;
	    name: string;
	    description: string;
	    unit: string;
	    customUnit: string;
	    targetValue: number;
	    periodType: string;
	    allowExceedTarget: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CreateKPIInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.goalId = source["goalId"];
	        this.initiativeId = source["initiativeId"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.unit = source["unit"];
	        this.customUnit = source["customUnit"];
	        this.targetValue = source["targetValue"];
	        this.periodType = source["periodType"];
	        this.allowExceedTarget = source["allowExceedTarget"];
	    }
	}
	export class DashboardSummaryOutput {
	    totalKpis: number;
	    activeKpis: number;
	    completedKpis: number;
	    overallPercent: number;
	
	    static createFrom(source: any = {}) {
	        return new DashboardSummaryOutput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalKpis = source["totalKpis"];
	        this.activeKpis = source["activeKpis"];
	        this.completedKpis = source["completedKpis"];
	        this.overallPercent = source["overallPercent"];
	    }
	}
	export class GoalOutput {
	    id: string;
	    title: string;
	    description: string;
	    status: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	    // Go type: time
	    archivedAt?: any;
	
	    static createFrom(source: any = {}) {
	        return new GoalOutput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.status = source["status"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	        this.archivedAt = this.convertValues(source["archivedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ImportResultOutput {
	    goalsCreated: number;
	    initiativesCreated: number;
	    kpisCreated: number;
	    entriesCreated: number;
	
	    static createFrom(source: any = {}) {
	        return new ImportResultOutput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.goalsCreated = source["goalsCreated"];
	        this.initiativesCreated = source["initiativesCreated"];
	        this.kpisCreated = source["kpisCreated"];
	        this.entriesCreated = source["entriesCreated"];
	    }
	}
	export class InitiativeOutput {
	    id: string;
	    goalId: string;
	    title: string;
	    description: string;
	    status: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	    // Go type: time
	    archivedAt?: any;
	
	    static createFrom(source: any = {}) {
	        return new InitiativeOutput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.goalId = source["goalId"];
	        this.title = source["title"];
	        this.description = source["description"];
	        this.status = source["status"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	        this.archivedAt = this.convertValues(source["archivedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class KPIEntryOutput {
	    id: string;
	    kpiId: string;
	    value: number;
	    entryDate: string;
	    comment: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new KPIEntryOutput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.kpiId = source["kpiId"];
	        this.value = source["value"];
	        this.entryDate = source["entryDate"];
	        this.comment = source["comment"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class KPIOutput {
	    id: string;
	    goalId: string;
	    initiativeId?: string;
	    name: string;
	    description: string;
	    unit: string;
	    customUnit: string;
	    targetValue: number;
	    periodType: string;
	    allowExceedTarget: boolean;
	    status: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	    // Go type: time
	    archivedAt?: any;
	
	    static createFrom(source: any = {}) {
	        return new KPIOutput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.goalId = source["goalId"];
	        this.initiativeId = source["initiativeId"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.unit = source["unit"];
	        this.customUnit = source["customUnit"];
	        this.targetValue = source["targetValue"];
	        this.periodType = source["periodType"];
	        this.allowExceedTarget = source["allowExceedTarget"];
	        this.status = source["status"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	        this.archivedAt = this.convertValues(source["archivedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class KPIProgressOutput {
	    kpiId: string;
	    currentValue: number;
	    targetValue: number;
	    percentage: number;
	    visualPercentage: number;
	    progressStatus: string;
	    isCompleted: boolean;
	    hasExceededTarget: boolean;
	
	    static createFrom(source: any = {}) {
	        return new KPIProgressOutput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kpiId = source["kpiId"];
	        this.currentValue = source["currentValue"];
	        this.targetValue = source["targetValue"];
	        this.percentage = source["percentage"];
	        this.visualPercentage = source["visualPercentage"];
	        this.progressStatus = source["progressStatus"];
	        this.isCompleted = source["isCompleted"];
	        this.hasExceededTarget = source["hasExceededTarget"];
	    }
	}
	export class RegisterKPIEntryInput {
	    kpiId: string;
	    value: number;
	    entryDate: string;
	    comment: string;
	
	    static createFrom(source: any = {}) {
	        return new RegisterKPIEntryInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kpiId = source["kpiId"];
	        this.value = source["value"];
	        this.entryDate = source["entryDate"];
	        this.comment = source["comment"];
	    }
	}
	export class UpdateGoalInput {
	    title: string;
	    description: string;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateGoalInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.description = source["description"];
	        this.status = source["status"];
	    }
	}
	export class UpdateInitiativeInput {
	    title: string;
	    description: string;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateInitiativeInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.description = source["description"];
	        this.status = source["status"];
	    }
	}
	export class UpdateKPIEntryInput {
	    value: number;
	    entryDate: string;
	    comment: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateKPIEntryInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.value = source["value"];
	        this.entryDate = source["entryDate"];
	        this.comment = source["comment"];
	    }
	}
	export class UpdateKPIInput {
	    name: string;
	    description: string;
	    unit: string;
	    customUnit: string;
	    targetValue: number;
	    periodType: string;
	    allowExceedTarget: boolean;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new UpdateKPIInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	        this.unit = source["unit"];
	        this.customUnit = source["customUnit"];
	        this.targetValue = source["targetValue"];
	        this.periodType = source["periodType"];
	        this.allowExceedTarget = source["allowExceedTarget"];
	        this.status = source["status"];
	    }
	}

}

