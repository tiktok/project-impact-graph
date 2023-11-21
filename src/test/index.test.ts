import path from 'path';
import _ from 'lodash';
import { ProjectImpactGraph } from '../index';

// Generate projectImpactGraph object
const filePath = path.resolve(__dirname, '../project-impact-graph.yaml');
const projectImpactGraph = new ProjectImpactGraph(filePath);

const mockProjectName = 'A';
const mockProjectNames = ['A', 'B'];
const mockPathList = [
    'OWNERS',
    'build.sh',
    'bootstrap.sh',
    'common/autoinstallers/temp',
    'projects/folder_A/index.ts',
    'projects/folder_A/README.md',
    'projects/folder_B/sub_module/package.json'
];
// project A and project B has impact intersection
const mockPathList1 = ['projects/folder_A/index.ts'];
const mockPathList2 = ['projects/folder_C/index.ts'];
// project E and project K has no impact intersection
const mockPathList3 = ['projects/folder_E/index.ts'];
const mockPathList4 = ['projects/folder_K/index.ts'];
// path list Contains file paths outside the project which are not matched by globalExcludedGlobs
const mockPathListOutsideProject = ['rush.json', 'pnpm-lock.yaml'];

describe('ProjectImpactGraph: Basic functions', () => {
    it('getProjectByProjectName', () => {
        const project = projectImpactGraph.getProjectByProjectName(mockProjectName);
        expect(project.hasOwnProperty('includedGlobs')).toBe(true);
        expect(project.hasOwnProperty('excludedGlobs')).toBe(true);
        expect(project.hasOwnProperty('dependentProjects')).toBe(true);
        expect(project.dependentProjects.includes(mockProjectName)).toBe(true);
    });
    it('lookUpProjectsByPathList', () => {
        const [projectNames, unMatchedPaths] = projectImpactGraph.lookUpProjectNamesByPathList(mockPathList);
        expect(_.isEqual(projectNames, ['A', 'B_subProject'])).toBe(true);
        expect(unMatchedPaths.length).toBe(0);
    });
    it('getProjectImpactByProjectNames', () => {
        const impact = projectImpactGraph.getProjectImpactByProjectNames(mockProjectNames);
        expect(_.isEqual(impact, ['A', 'B', 'E', 'G', 'H', 'F', 'M'])).toBe(true);
    });
});

describe('ProjectImpactGraph: different business cases', () => {
    it('Path list Contains file paths outside the project which are not matched by globalExcludedGlobs', () => {
        const res = projectImpactGraph.hasImpactIntersection(mockPathList, mockPathListOutsideProject);
        expect(res).toBe(true);
    });
    it('Two path lists has intersection', () => {
        const res = projectImpactGraph.hasImpactIntersection(mockPathList1, mockPathList2);
        expect(res).toBe(true);
    });
    it('Two path lists has no intersection', () => {
        const res = projectImpactGraph.hasImpactIntersection(mockPathList3, mockPathList4);
        expect(res).toBe(false);
    });
});
