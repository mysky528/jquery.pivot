﻿///<reference path="definitions/jquery.d.ts"/>
///<reference path="lib.ts"/>
module jquerypivot {
    function sortgroupbys(rowA, rowB) {
        var a = +rowA.groupbyrank,
            b = +rowB.groupbyrank;

        return (a < b) ? -1 : (a > b) ? 1 : 0;
    }

    function trim(oIn) {
        if (typeof oIn === 'string' || oIn === null) {
            return $.trim(oIn);
        }
        else {
            return oIn;
        }
    }

    export interface column{
        colvalue: string;
        coltext: string;
        header?: string;
        sortbycol: string;
        groupbyrank: number;
        pivot?: boolean;
        result?: boolean;
        dataid?: string;
        datatype?: string;
        text?: string;
        colindex?: number;
    }

    export interface jsonsource{
        dataid: string;
        columns: column[];
        rows: any[];
    }

    export interface pivotItem {
        pivotValue: any; 
        result: any; 
        sortby: any; 
        dataid: any
    }

    export class TreeNode {
        groupbyValue: string;
        groupbyText: string;
        colindex: number;
        children:TreeNode[] = [];
        sortby: string;
        parent: TreeNode;
        dataid: string;
        collapsed: boolean;
        groupbylevel: number;
        pivotvalues:pivotItem[] =[];
        visible() {
            return this.parent === undefined || (!this.parent.collapsed && (!this.parent.visible || this.parent.visible()));
        }

    }

    export class Adapter {
        dataid: string;
        alGroupByCols: column[];
        bInvSort: boolean;
        pivotCol: column;
        resultCol: column;
        tree: TreeNode;
        uniquePivotValues: pivotItem[];
        sortPivotColumnHeaders: boolean;

        constructor() {
            this.alGroupByCols = [];
            this.pivotCol = null;
            this.resultCol = null;
            this.bInvSort = false;
            this.tree = new TreeNode();
            this.uniquePivotValues = [];
            this.dataid = null;
            this.sortPivotColumnHeaders = true;
        }

        sortTree(treeNode : TreeNode) {
            var i: number,
                datatype: string;
            if (treeNode.children && treeNode.children.length > 0) {
                for (i = 0; i < treeNode.children.length; i += 1) {
                    this.sortTree(treeNode.children[i]);
                }

                datatype = this.findCell(this.alGroupByCols, treeNode.children[0].colindex).datatype;
                treeNode.children.sort(this.getcomparer(this.bInvSort)[datatype]);
            }
        }

        findCell(arCells: column[], colIndex: number) {
            return lib.find(arCells, function (item: column, index: number) {
                return item.colindex == this;
            }, colIndex);
        }

        getcomparer(bInv: boolean) {
            function comp(f) {
                return function (rowA: TreeNode, rowB: TreeNode) {
                    var out = (f(rowA.sortby) < f(rowB.sortby)) ? -1 : (f(rowA.sortby) > f(rowB.sortby)) ? 1 : 0;
                    return bInv ? -out : out;
                }
            }

            return  { 
                'string': comp(s => { return s }), 
                'number': comp(i => { return +i }) 
            };
        }
        
        parseJSONsource(data : jsonsource) {
            var cellIndex:number, 
                cellcount:number, 
                rowIndex:number, 
                rowcount:number, 
                i:number, 
                sourcecol:column, 
                treecol: column, 
                curNode:TreeNode, 
                newObj:TreeNode, 
                groupbyValue, 
                groupbyText, 
                sortbyValue, 
                pivotValue, 
                pivotSortBy, 
                result, 
                newPivotValue:pivotItem,
                rowitem:any,
                row:any[];

            this.dataid = data.dataid;
            //exctract header info
            for (cellIndex = 0, cellcount = data.columns.length; cellIndex < cellcount; cellIndex += 1) {
                sourcecol = data.columns[cellIndex];
                treecol = {
                    colvalue: sourcecol.colvalue,
                    coltext: sourcecol.coltext,
                    text: sourcecol.header || sourcecol.coltext || sourcecol.colvalue,
                    colindex: cellIndex,
                    datatype: sourcecol.datatype || 'string',
                    sortbycol: sourcecol.sortbycol || sourcecol.coltext || sourcecol.colvalue,
                    dataid: sourcecol.dataid || sourcecol.colvalue,
                    groupbyrank: sourcecol.groupbyrank
                };

                if (typeof(treecol.groupbyrank) === 'number' && isFinite(treecol.groupbyrank)) {
                    this.alGroupByCols.push(treecol);
                }
                else if (sourcecol.pivot) {
                    this.pivotCol = treecol;
                }
                else if (sourcecol.result) {
                    this.resultCol = treecol;
                }
            }

            this.alGroupByCols.sort(sortgroupbys);

            function findGroupByFunc(item:TreeNode, index:number) { 
                return item.groupbyValue == this; 
            }
            function findPivotFunc(item:pivotItem, index:number) { 
                return item.pivotValue == this; 
            }

            //build tree structure
            for (rowIndex = 0, rowcount = data.rows.length; rowIndex < rowcount; rowIndex += 1) {
                row = data.rows[rowIndex];
                curNode = this.tree;
                //groupbys
                for (i = 0; i < this.alGroupByCols.length; i += 1) {
                    groupbyValue = trim(row[this.alGroupByCols[i].colvalue]);
                    groupbyText = row[this.alGroupByCols[i].coltext];
                    sortbyValue = trim(row[this.alGroupByCols[i].sortbycol]);
                    newObj = lib.find<TreeNode>(curNode.children, findGroupByFunc, groupbyValue);
                    if (!newObj) {
                        newObj = new TreeNode();
                        newObj.groupbyValue = groupbyValue;
                        newObj.groupbyText = groupbyText;
                        newObj.colindex = this.alGroupByCols[i].colindex;
                        newObj.children = [];
                        newObj.sortby = sortbyValue;
                        newObj.parent = curNode;
                        newObj.dataid = this.alGroupByCols[i].dataid;
                        newObj.collapsed = true;
                        newObj.groupbylevel = i;
                        curNode.children.push(newObj);
                    }

                    curNode = newObj;
                }
                //pivot
                pivotValue = trim(row[this.pivotCol.colvalue]);
                pivotSortBy = trim(row[this.pivotCol.sortbycol]);
                result = trim(row[this.resultCol.colvalue]);
                newPivotValue = { pivotValue: pivotValue, result: result, sortby: pivotSortBy, dataid: this.pivotCol.dataid };
                curNode.pivotvalues.push(newPivotValue);
                if (!lib.exists(this.uniquePivotValues, findPivotFunc, pivotValue)) {
                    this.uniquePivotValues.push(newPivotValue);
                }
            }

            this.sortTree(this.tree);
            if (this.sortPivotColumnHeaders) {
                this.uniquePivotValues.sort(this.getcomparer(this.bInvSort)[this.pivotCol.datatype]);
            }
        }

        parseFromXhtmlTable(sourceTable: JQuery) {
            var cellIndex:number, 
                cellcount:number, 
                rowIndex:number, 
                rowcount:number, 
                el: JQuery, 
                eltext:string, 
                col:column, 
                cells:HTMLTableCellElement[], 
                row: {},
                data :jsonsource = { 
                    dataid: sourceTable.attr('dataid'), 
                    columns: [], 
                    rows: [] 
                },
                //exctract header info
                rows = <HTMLTableRowElement[]><any> $('tbody > tr', sourceTable),
                columnNames:string[] = [];
            
            for (cellIndex = 0, cellcount = rows[0].cells.length; cellIndex < cellcount; cellIndex += 1) {
                el = $(rows[0].cells[cellIndex]);
                eltext = el.text();
                col = {
                    colvalue: el.attr('colvalue') || eltext,
                    coltext: el.attr('coltext') || eltext,
                    header: el.attr('header') || el.text(),
                    datatype: el.attr('datatype'),
                    sortbycol: el.attr('sortbycol') || eltext,
                    dataid: el.attr('dataid'),
                    groupbyrank: parseInt(el.attr('groupbyrank'), 10),
                    pivot: el.attr('pivot') === 'true',
                    result: el.attr('result') === 'true'
                };
                data.columns.push(col);
                columnNames.push(eltext);
            }

            //extract rows
            for (rowIndex = 1, rowcount = rows.length; rowIndex < rowcount; rowIndex += 1) {
                cells =  <HTMLTableCellElement[]><any>rows[rowIndex].cells;
                row = {};
                for (cellIndex = 0, cellcount = columnNames.length; cellIndex < cellcount; cellIndex += 1) {
                    eltext = cells[cellIndex].innerHTML;
                    row[columnNames[cellIndex]] = (data.columns[cellIndex].datatype === 'number') ? <any>parseFloat(eltext) : <any>eltext;
                }
                data.rows.push(row);
            }

            this.parseJSONsource(data);
        }

    }
}



