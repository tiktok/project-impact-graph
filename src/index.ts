// Copyright (c) TikTok Pte. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import fs from 'fs';
import yaml from 'yaml';
import _ from 'lodash';

/**
 * Project property configuration
 */
export interface IProjectConfiguration {
    includedGlobs: string[];
    excludedGlobs: string[];
    dependentProjects: string[];
}

/**
 * The schema of `project-impact-graph.yaml`
 */
export interface IFileSchema {
    globalExcludedGlobs: string[];
    projects: {
        [key: string]: IProjectConfiguration;
    };
}

/**
 * Stores the complete project-impact-graph and provide relevant functions
 * Constructs instance based on the path of `project-impact-graph.yaml`
 */
export class ProjectImpactGraph {
    private _filePath: string;
    private _projectImpactGraph: IFileSchema;
    private _globalExcludedGlobs: string[];
    private _projectExcludedGlobs: string[];
    constructor(path: string) {
        this._filePath = path;
        this._projectImpactGraph = this._parseFile();
        this._globalExcludedGlobs = this._projectImpactGraph.globalExcludedGlobs;
        this._projectExcludedGlobs = this._integrateExcludedGlobs();
    }
    /**
     *  Reads `project-impact-graph.yaml` and returns the content as an object
     */
    private _parseFile(): IFileSchema {
        const fileContent = fs.readFileSync(this._filePath, 'utf-8');
        const projectImpactGraph: IFileSchema = yaml.parse(fileContent);
        return projectImpactGraph;
    }
    /**
     * Integrates and returns an array of excludedGlobs from all projects
     */
    private _integrateExcludedGlobs(): string[] {
        const { projects } = this._projectImpactGraph;
        const projectExcludedGlobs: string[] = [];
        for (const project in projects) {
            projectExcludedGlobs.push(...projects[project].excludedGlobs);
        }
        return _.uniq(projectExcludedGlobs);
    }
    /**
     * Filters excluded paths and returns an array of valid paths
     *
     * @param pathList - An array of paths changed
     */
    private _validatePaths(pathList: string[]): string[] {
        const globs = this._globalExcludedGlobs.concat(this._projectExcludedGlobs);
        const validPaths = pathList.filter((path) => {
            let notMatched = true;
            globs.forEach((glob) => {
                if (path.startsWith(glob)) {
                    notMatched = false;
                }
            });
            return notMatched;
        });
        return validPaths;
    }
    /**
     * Returns projectConfiguration { includedGlobs, excludedGlobs, dependentProjects }
     *
     * @param projectName - A name of one project
     */
    public getProjectByProjectName(projectName: string): IProjectConfiguration {
        return this._projectImpactGraph.projects[projectName];
    }
    /**
     * Looks up projects by project names
     * returns [an array of project names, an array of unmatched paths]
     *
     * @param pathList - An array of paths changed
     */
    public lookUpProjectNamesByPathList(pathList: string[]): [string[], string[]] {
        if (!pathList || pathList.length === 0) {
            return [[], []];
        }
        const validPaths = this._validatePaths(pathList);
        const projectNames: string[] = [];
        const unMatchedPaths: string[] = [];
        const { projects } = this._projectImpactGraph;
        validPaths.forEach((path) => {
            const matchedProjects: { projectName: string; depth: number }[] = [];
            for (const projectName in projects) {
                const { includedGlobs } = projects[projectName];
                includedGlobs.forEach((glob) => {
                    if (path.startsWith(glob)) {
                        matchedProjects.push({ projectName, depth: glob.split('/').length });
                    }
                });
            }
            if (matchedProjects.length > 0) {
                const deepest = matchedProjects.reduce((prev, current) => {
                    return prev.depth > current.depth ? prev : current;
                });
                projectNames.push(deepest.projectName);
            } else {
                unMatchedPaths.push(path);
            }
        });
        return [_.uniq(projectNames), unMatchedPaths];
    }
    /**
     * Calculates the impact scope by project names and returns an array of impacted project names.
     *
     * @param projectNames - An array of project names
     */
    public getProjectImpactByProjectNames(projectNames: string[]): string[] {
        if (!projectNames || projectNames.length === 0) {
            return [];
        }
        const impact: string[] = [...projectNames];
        const queue: string[] = [...projectNames];
        const { projects } = _.cloneDeep(this._projectImpactGraph);
        while (queue.length !== 0) {
            const currentProject = queue.shift();
            const dependents = projects[currentProject as string].dependentProjects;
            dependents.forEach((item) => {
                if (!impact.includes(item)) {
                    impact.push(item);
                    queue.push(item);
                }
            });
            delete projects[currentProject as string];
        }
        return impact;
    }
    /**
     * Determines and returns whether the two path lists has intersection
     *
     * @param pathList1 - An array of paths changed
     * @param pathList2 - An array of paths changed
     */
    public hasImpactIntersection(pathList1: string[], pathList2: string[]): boolean {
        const [projectNames1, unMatchedPaths1] = this.lookUpProjectNamesByPathList(pathList1);
        const [projectNames2, unMatchedPaths2] = this.lookUpProjectNamesByPathList(pathList2);
        if (unMatchedPaths1.length > 0 || unMatchedPaths2.length > 0) {
            return true;
        }
        const impact1 = this.getProjectImpactByProjectNames(projectNames1);
        const impact2 = this.getProjectImpactByProjectNames(projectNames2);
        const intersection = impact1.filter((projectName) => impact2.includes(projectName));
        if (intersection.length === 0) {
            return false;
        }
        return true;
    }
}
