import * as path from "path";
import * as vscode from "vscode";
import * as keytar from "keytar";
// import { AppInsightsClient } from "../common/appInsightsClient";
import { Constants } from "../util/constants";
import {  Memory } from "../util/storage";
import { executeQuery } from "../util/hanadb";
import { DBTreeDataProvider } from "../DBTreeProvider";
import { DatabaseNode } from "./databaseNode";
// import { InfoNode } from "./infoNode";
import { INode } from "./INode";
import { IConnection } from "./Connection";

export class ConnectionNode implements INode {
    constructor(private readonly id:string, private readonly connection: IConnection) {
    }
    public connectToNode() {
        const connection = {...this.connection};
        Memory.state.update('activeConnection', connection);
        return this.id;
    }
    public getTreeItem(): vscode.TreeItem {
        const id = `${this.connection.user}@${this.connection.host}-${this.connection.databaseName}`;
        const activeConnection = Memory.state.get<IConnection>('activeConnection');
        return {
            label: id,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: "connection",
            iconPath: path.join(__filename, "..", "..", "..", "media", this.equalsConnection(activeConnection) ? "db-active.png": 'db-inactive.png'),
        };
    }
    private equalsConnection(activeConnection:IConnection|undefined):Boolean{
        if(!activeConnection){
            return false;
        }
        if(this.connection.host !== activeConnection.host){
            return false;
        }
        if(this.connection.user !== activeConnection.user){
            return false;
        }
        if(this.connection.port !== activeConnection.port){
            return false;
        }
        if(this.connection.instanceNumber !== activeConnection.instanceNumber){
            return false;
        }
        if(this.connection.databaseName !== activeConnection.databaseName){
            return false;
        }
        return true;
    }
    public async getChildren(): Promise<INode[]> {
        const dbs = await executeQuery(this.connection, `SELECT SCHEMA_NAME as "name" FROM SYS.SCHEMAS WHERE HAS_PRIVILEGES = 'TRUE'`);
         return dbs.map<DatabaseNode>(({name}) => {
            return new DatabaseNode(this.connection, name);
        });
    }

    public async newQuery() {
        // AppInsightsClient.sendEvent("newQuery", { viewItem: "connection" });
        // Utility.createSQLTextDocument();

        Memory.state.update('activeConnection', this.connection);
    }

    public async deleteConnection(context: vscode.ExtensionContext, treeProvider: DBTreeDataProvider) {
        // AppInsightsClient.sendEvent("deleteConnection");
        const connections = context.globalState.get<{ [key: string]: IConnection }>(Constants.ConnectionsKeys);
        if(connections){
            delete connections[this.id];
        }
        await context.globalState.update(Constants.ConnectionsKeys, connections);

        await keytar.deletePassword(Constants.ExtensionId, this.id);

        treeProvider.refresh();
    }
}