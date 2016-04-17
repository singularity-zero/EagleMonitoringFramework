﻿/// <reference path="../../typings/all.d.ts"/>

import * as log from "../../common/log";
import { ObservableCollectionManager, IObservableRepositoryEvent } from "../../common/observable-collection-manager";
import _ = require("lodash");
import $ = require("../../libs/jquery");
import React = require("react");
import ReactDOM = require("react-dom");
import ReactGridLayout = require("../../libs/react-grid-layout");
import "./main.less";
import "font-awesome/css/font-awesome.min.css";

log.logger.setLogLevel(log.LogLevel.Debug);
log.logger.logEvents.subscribe(new log.ConsoleObserver());

class BuildStateCollection {

    map: { [buildDefinitionId: string]: BuildState } = {};
    count = 0;

    get(buildDefinitionId: string): BuildState {
        var value = this.map[buildDefinitionId];
        if (value) {
            return value;
        } else {
            this.map[buildDefinitionId] = value = new BuildState();
            this.count++;
            return value;
        }
    }

    deleteDefinition(buildDefinitionId: string) {
        this._delete(buildDefinitionId, "definition");
    }

    deleteLatestBuild(buildDefinitionId: string) {
        this._delete(buildDefinitionId, "latestBuild");
    }

    private _delete(buildDefinitionId: string, path: string) {
        var value = this.map[buildDefinitionId];
        if (value) {
            value[path] = null;
            if (!value.definition && !value.latestBuild) {
                delete this.map[buildDefinitionId];
                this.count--;
            }
        }
    }
}

class MainComponent {

    buildStates: BuildStateCollection;
    manager: ObservableCollectionManager;
    settings: ISettings;

    constructor() {

        this.manager = new ObservableCollectionManager("./signalr", { clearError: () => { }, showError: message => { } });
        this.buildStates = new BuildStateCollection();

        this.manager.subscribe<ISettings>("settings", {
            onNewEvent: event => {
                this.settings = event.newOrUpdatedItems[0].value;
                this.render();
            }
        });

        this.manager.subscribe<IBuildDefinitionReference>("buildDefinitions", {
            onNewEvent: event => {
                _.forEach(event.newOrUpdatedItems, buildDefinition => {
                    const buildState = this.buildStates.get(buildDefinition.key);
                    buildState.definition = buildDefinition.value;
                });

                _.forEach(event.deletedItemKeys, key => {
                    this.buildStates.deleteDefinition(key);
                });

                this.render();
            }
        });

        this.manager.subscribe<IBuild>("builds", {
            onNewEvent: event => {
                _.forEach(event.newOrUpdatedItems, build => {
                    const buildState = this.buildStates.get(build.key);

                    if (buildState.latestBuild && buildState.definition) {
                        log.information("{buildName} changed to {newStatus} - {newResult} (from {oldStatus} - {oldResult})",
                            buildState.definition.name,
                            BuildStatus[build.value.status], BuildResult[build.value.result],
                            BuildStatus[buildState.latestBuild.status], BuildResult[buildState.latestBuild.result]);
                    }

                    buildState.latestBuild = build.value;
                });

                _.forEach(event.deletedItemKeys, key => {
                    this.buildStates.deleteLatestBuild(key);
                });

                this.render();
            }
        });
    }

    onLayoutChanged(itemProps: ReactGridLayout.ItemProps[]) {

    }

    render = () => {

        const buildStates = _(this.buildStates.map)
            .map((value: BuildState) => value)
            .filter((value: BuildState) => value.definition && !_.startsWith(value.definition.name, "OLD_") && !_.endsWith(value.definition.name, "_Deprecated"))
            .orderBy((value: BuildState) => value.definition.name)
            .value();

        const groupedBuildStates = _(buildStates).groupBy(s => this.getProjectPath(s.definition.name))
            .map((buildStates: BuildState[], key: string) => { return { buildStates, key }; })
            .orderBy(b => b.key)
            .value();

        const values = _.map(groupedBuildStates, group => {
            return this.getProjectComponent(group.buildStates, group.key);
        });

        const columnCount = 5;
        const columnHeights = _.map(_.range(0, columnCount), columnIndex => { return { columnIndex, height: 0 }; });

        const layout = _.map(groupedBuildStates, group => {

            var minHeightColumn = _.minBy(columnHeights, c => c.height);
            var elementHeight = 1;

            var layoutItem: ReactGridLayout.ItemProps = {
                i: group.key,
                x: minHeightColumn.columnIndex, y: minHeightColumn.height, w: 1, h: elementHeight
            };

            minHeightColumn.height += elementHeight;

            return layoutItem;
        });

        ReactDOM.render(<ReactGridLayout layout={layout} cols={columnCount} rowHeight={50} onLayoutChange={this.onLayoutChanged}>{values}</ReactGridLayout>,
            $(".builds")[0]
        );
    }

    getBuildUrl(buildState: BuildState) {
        if (this.settings) {
            return `${this.settings.tfsCollectionUrl}/${this.settings.tfsProject}/_build#definitionId=${buildState.definition.id}&_a=completed`;
        }
    }

    getProjectComponent(buildStates: BuildState[], key: string) {
        return <div key={key} style={{ backgroundColor: this.getProjectStateColor(buildStates) }}>
            <div style={{ height: "100%", display: "flex", flexDirection: "row-reverse", alignItems: "center", alignContents: "center", padding: "0 10px" }}>

                <div style={{ whiteSpace: "nowrap" }}>
                    {_.map(buildStates, buildState => this.getProjectBuildComponent(buildState)) }
                </div>

                <div style={{ textOverflow: "ellipsis", overflow: "hidden", verticalAlign: "middle", whiteSpace: "nowrap", flexGrow: 1 }}>
                    <div style={{ fontSize: "1.4em" }}>{this.getProjectName(key) }</div>
                    <div style={{ fontSize: "0.5em" }}>{this.getProjectParentPath(key) }</div>
                </div>

            </div>
        </div>;
    }

    getProjectBuildComponent(buildState: BuildState) {
        return <a key={buildState.definition.id} className="project-build" href={this.getBuildUrl(buildState)} target="_blank"
            style={{ backgroundColor: this.getBuildStateColor(buildState), margin: "0 0 0 5px", padding: "4px 4px", borderRadius: "2px", display: "inline-block", color: "black", textDecoration: "none" }}
            title={buildState.definition.name}>
            {this.getProjectBuildIconComponent(this.getProjectBuildName(buildState.definition.name))}{this.getTestsComponent(buildState) }
        </a>;
    }

    getProjectBuildIconComponent(name: string) {

        var icon = this.getProjectBuildIcon(name);

        if (icon) {
            return <i className={`fa fa-${icon}`}></i>;
        } else {
            return <span>{name}</span>;
        }
    }

    getProjectBuildIcon(name: string) {
        switch (name) {
            case "Release":
                return "star";
            case "N":
                return "moon-o";
            case "CI":
                return "sun-o";
            case "N_UI":
                return "desktop";
        }
    }

    getTestsComponent(buildState: BuildState) {
        if (buildState.latestBuild && buildState.latestBuild.testRuns.length > 0) {
            return _(buildState.latestBuild.testRuns)
                .filter(testRun => testRun.passedTests + testRun.notApplicableTests !== testRun.totalTests)
                .map(testRun => {
                    return <span key={testRun.id} style={{ marginLeft: '4px' }}>{testRun.passedTests}/{testRun.totalTests}</span>;
                })
                .value();
        } else {
            return null;
        }
    }

    getProjectBuildName(name: string) {
        const buildName = this.substringFromLast(name, ".");
        const buildNamePostfix = this.substringFromFirst(buildName, "_");
        if (buildName === buildNamePostfix)
            return "Release";
        return buildNamePostfix;
    }

    getProjectName(name: string) {
        const projectPath = this.getProjectPath(name);

        if (!projectPath)
            return null;

        const projectNameStart = _.lastIndexOf(projectPath, ".");
        if (projectNameStart === -1)
            return projectPath;

        return projectPath.substring(projectNameStart + 1);
    }

    getProjectParentPath(name: string) {
        const projectPath = this.getProjectPath(name);

        if (!projectPath)
            return null;

        const projectNameStart = _.lastIndexOf(projectPath, ".");
        if (projectNameStart === -1)
            return projectPath;

        return projectPath.substring(0, projectNameStart);
    }

    getProjectPath(name: string) {
        const projectNameStart = _.lastIndexOf(name, ".");
        if (projectNameStart === -1)
            return name;
        const buildNamePostfixStart = _.indexOf(name, "_", projectNameStart);
        if (buildNamePostfixStart === -1)
            return name;
        return name.substring(0, buildNamePostfixStart);
    }

    substringFromFirst(str: string, separator: string) {
        const index = _.indexOf(str, separator);
        return index === -1 ? str : str.substring(index + 1);
    }

    substringFromLast(str: string, separator: string) {
        const index = _.lastIndexOf(str, separator);
        return index === -1 ? str : str.substring(index + 1);
    }

    getProjectStateColor(buildStates: BuildState[]) {

        const buildStatesWithResults = _.filter(buildStates, b => b.latestBuild && b.latestBuild.result);

        let mostImportantResult = { status: BuildStatus.None, result: BuildResult.None };

        if (_.some(buildStatesWithResults)) {
            mostImportantResult = _(buildStatesWithResults)
                .map(b => b.latestBuild)
                .map(b => { return { alertLevel: this.getBuildResultImportanceLevel(b.status, b.result), status: b.status, result: b.result }; })
                .maxBy(r => r.alertLevel);
        }

        const color = this.getBuildResultColor(mostImportantResult.status, mostImportantResult.result);

        return Color.parseColor(color).mix(Color.white, 0.5).toString();
    }

    getBuildResultImportanceLevel(status: BuildStatus, result: BuildResult) {
        if (!_.isNull(result) && result !== BuildResult.None) {
            switch (result) {
                case BuildResult.Succeeded:
                    return 15;
                case BuildResult.PartiallySucceeded:
                    return 16;
                case BuildResult.Failed:
                    return 20;
                case BuildResult.Canceled:
                    return 10;
            }
        } else if (!_.isNull(status)) {
            switch (status) {
                case BuildStatus.InProgress:
                    return 19;
                default:
                    return 0;
            }
        } else {
            return 0;
        }
    }

    getBuildStateColor(buildState: BuildState) {

        if (!buildState.latestBuild)
            return this.getBuildResultColor(BuildStatus.None, BuildResult.None);

        return this.getBuildResultColor(buildState.latestBuild.status, buildState.latestBuild.result);
    }

    getBuildResultColor(status: BuildStatus, result: BuildResult) {
        if (!_.isNull(result) && result !== BuildResult.None) {
            switch (result) {
                case BuildResult.Succeeded:
                    return "#5CB85C";
                case BuildResult.PartiallySucceeded:
                    return "#F0AD4E";
                case BuildResult.Failed:
                    return "#D9534F";
                case BuildResult.Canceled:
                    return "#5BC0DE";
                default:
                    return "#5CB85C";
            }
        } else if (!_.isNull(status)) {
            switch (status) {
                case BuildStatus.InProgress:
                    return "#569CD6";
                default:
                    return "#5CB85C";
            }
        } else {
            return null;
        }
    }
}

class Color {

    static white = new Color(255, 255, 255);
    static black = new Color(0, 0, 0);

    constructor(public red: number, public green: number, public blue: number) { }

    static parseColor(color: string): Color {
        const m = color.match(/^#([0-9a-f]{6})$/i)[1];
        if (m) {
            return new Color(
                parseInt(m.substr(0, 2), 16),
                parseInt(m.substr(2, 2), 16),
                parseInt(m.substr(4, 2), 16)
            );
        }
        return new Color(0, 0, 0);
    }

    mix(color: Color, newColorWeighting: number): Color {
        const n = newColorWeighting;
        const o = 1 - n;
        return new Color(o * this.red + n * color.red, o * this.green + n * color.green, o * this.blue + n * color.blue);
    }

    toString() {
        const str = "#" + Math.round(this.red).toString(16) + Math.round(this.green).toString(16) + Math.round(this.blue).toString(16);
        return str;
    }
}

var mainComponent = new MainComponent();

class BuildState {

    constructor() {
        this.viewModel = { order: 0, width: 1, height: 1 };
    }

    definition: IBuildDefinitionReference;
    latestBuild: IBuild;
    viewModel: IBuildStateViewModel;


}

interface IBuildStateViewModel {
    order: number;
    width: number;
    height: number;
}

interface IBuildDefinitionReference {
    id: number;
    revision: number;
    name: string;
    type: DefinitionType;
}

interface IBuild {

    id: number;
    definition: IBuildDefinitionReference;

    status: BuildStatus;

    queueTime: string;
    startTime: string;
    finishTime: string;

    result: BuildResult;

    testRuns: ITestRun[];
}

interface ITestRun {
    id: number;
    incompleteTests: number;
    passedTests: number;
    notApplicableTests: number;
    totalTests: number;
    errorMessages: string;
}

interface ISettings {
    tfsCollectionUrl: string;
    tfsProject: string;
}

enum DefinitionType {
    Xaml = 1,
    Build = 2
}

enum BuildStatus {
    None = 0,
    InProgress = 1,
    Completed = 2,
    Cancelling = 4,
    Postponed = 8,
    NotStarted = 32,
    All = 47
}

enum BuildResult {
    None = 0,
    Succeeded = 2,
    PartiallySucceeded = 4,
    Failed = 8,
    Canceled = 32,
}