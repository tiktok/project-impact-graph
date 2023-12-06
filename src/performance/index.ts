import path from 'path';
import fs from 'fs';
import yaml from 'yaml';
import { IFileSchema, ProjectImpactGraph } from '../index';

/**
 * Each node represents a project
 */
type INode = {
    id: number;
    edges: INode[];
    dependentNodes: INode[];
};

/**
 * Returns a directed acyclic graph, representing a monorepo's dependency relations,
 *
 * @param nodeCount - the number of project
 * @param nodeCount - the number of dependent/dependency relation
 */
export function generateDAG(nodeCount: number, edgeCount: number): INode[] {
    if (edgeCount < nodeCount - 1) {
        throw new Error('Edges are not enough to connect all nodes');
    }
    if (edgeCount > (nodeCount * (nodeCount - 1)) / 2) {
        throw new Error('Too many edges');
    }
    const nodes: INode[] = Array.from({ length: nodeCount }, (_, idx) => ({
        id: idx,
        edges: [],
        dependentNodes: []
    }));
    // Create an initial chain of nodes
    for (let i = 0; i < nodeCount - 1; i++) {
        nodes[i + 1].edges.push(nodes[i]);
        nodes[i].dependentNodes.push(nodes[i + 1]);
    }
    // Each node adds itself as dependent
    for (let i = 0; i < nodeCount; i++) {
        nodes[i].dependentNodes.push(nodes[i]);
    }
    edgeCount -= nodeCount - 1;
    const maxTry = 3;
    /**
     * Choose a random node to use as the starting point of each new edge.
     * This node has a higher ID than the edge's end point to ensure that the edge it adds does not form a closed loop in the graph.
     */
    while (edgeCount > 0) {
        let fromId = Math.floor(Math.random() * nodeCount);
        let toId = Math.floor(Math.random() * fromId);
        let tryCount = 0;
        // If the edge already exists, try to change a random set of nodes
        while (nodes[fromId].edges.some((node) => node.id === toId)) {
            if (tryCount === maxTry) {
                break;
            }
            toId = Math.floor(Math.random() * fromId);
            tryCount += 1;
        }
        if (tryCount === maxTry) {
            continue;
        }
        // If the new edge does not exist, add it to the graph and add dependent relation to the associated nodes.
        nodes[fromId].edges.push(nodes[toId]);
        nodes[toId].dependentNodes.push(nodes[fromId]);
        edgeCount--;
    }
    return nodes;
}

/**
 * Generate project-impact-graph.yaml
 *
 * @param nodeCount - the number of project
 * @param nodeCount - the number of dependent/dependency relation
 */
export const genYamlFile = (nodeCount: number, edgeCount: number) => {
    const nodes = generateDAG(nodeCount, edgeCount);
    const content: IFileSchema = {} as IFileSchema;
    content.globalExcludedGlobs = ['OWNERS', 'build.sh', 'bootstrap.sh', 'common/autoinstallers'];
    content.projects = {};
    nodes.forEach((project) => {
        content.projects[`project_${project.id}`] = {
            includedGlobs: [`projects/folder_${project.id}`],
            excludedGlobs: [`projects/folder_${project.id}/README.md`],
            dependentProjects: project.dependentNodes.map((dep) => `project_${dep.id}`)
        };
    });
    const filePath = path.resolve(__dirname, `./project-impact-graph-${nodeCount}N-${edgeCount}E.yaml`);
    fs.writeFileSync(filePath, yaml.stringify(content));
    return filePath;
};

/**
 * Returns an array of paths
 *
 * @param pathNumber - the number of path
 */
const generatePaths = (pathNumber: number) => {
    const pathList: string[] = [];
    while (pathNumber > 0) {
        pathList.push(`projects/folder_${pathNumber - 1}/index.ts`);
        pathNumber -= 1;
    }
    return pathList;
};

/**
 * Test performance and generate report file
 */
const performance = () => {
    const testConfigs = [
        { nodeCount: 1000, edgeCount: 5000, pathCountA: 1, pathCountB: 1 },
        { nodeCount: 1000, edgeCount: 5000, pathCountA: 10, pathCountB: 10 },
        { nodeCount: 1000, edgeCount: 5000, pathCountA: 100, pathCountB: 100 },
        { nodeCount: 1000, edgeCount: 5000, pathCountA: 1000, pathCountB: 1000 },
        { nodeCount: 2000, edgeCount: 10000, pathCountA: 1, pathCountB: 1 },
        { nodeCount: 2000, edgeCount: 10000, pathCountA: 10, pathCountB: 10 },
        { nodeCount: 2000, edgeCount: 10000, pathCountA: 100, pathCountB: 100 },
        { nodeCount: 2000, edgeCount: 10000, pathCountA: 1000, pathCountB: 1000 },
        { nodeCount: 3000, edgeCount: 100000, pathCountA: 1, pathCountB: 1 },
        { nodeCount: 3000, edgeCount: 100000, pathCountA: 10, pathCountB: 10 },
        { nodeCount: 3000, edgeCount: 100000, pathCountA: 100, pathCountB: 100 },
        { nodeCount: 3000, edgeCount: 100000, pathCountA: 1000, pathCountB: 1000 }
    ];
    const performanceReport: object[] = [];
    testConfigs.forEach((config) => {
        const filePath = genYamlFile(config.nodeCount, config.edgeCount);
        const startTime = new Date().getTime();
        const projectImpactGraph = new ProjectImpactGraph(filePath);
        const mockPathListA = generatePaths(config.pathCountA);
        const mockPathListB = generatePaths(config.pathCountB);
        const res = projectImpactGraph.hasImpactIntersection(mockPathListA, mockPathListB);
        const endTime = new Date().getTime();
        const executeTime = (endTime - startTime) / 1000;
        performanceReport.push({
            ...config,
            hasImpactIntersection: res,
            executeTime: `${executeTime}s`
        });
    });
    fs.writeFileSync(path.resolve(__dirname, './performance-report'), JSON.stringify(performanceReport, null, 2));
    return performanceReport;
};

// run `ts-node src/performance/index.ts` to execute performance test
const report = performance();
console.log(report);
