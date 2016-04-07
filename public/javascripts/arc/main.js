
define([
    "dojo/request/xhr",
    "dojo/io-query",
    "dojo/dom",
    "dojo/dom-style",
    "dijit/registry",
    "dojo/dom-construct",
    "dojo/on",
    "dojo/dom-attr",
    "dojo/keys",
    "dojo/dom-form",
    "dojo/_base/declare",
    "dijit/_WidgetBase",
    "dijit/popup",
    "dojo/when",
    "dojo/_base/lang",
    
    "dojo/store/Cache",
    "dojo/store/Memory",
    "dojo/store/JsonRest",
    "gridx/core/model/cache/Async",
    "gridx/Grid",
    
    "dijit/layout/TabContainer",
    "dijit/layout/BorderContainer",
    "dijit/layout/ContentPane",
    
    "dijit/form/Button",
    "dijit/form/TextBox",
    "dijit/form/NumberTextBox",
    "dijit/form/FilteringSelect",
    "dijit/form/DateTextBox",
    "dijit/form/Textarea",
    "dijit/form/CheckBox",
    "dijit/form/DropDownButton",
    "dijit/form/ValidationTextBox",
    "dijit/form/NumberSpinner",

    "dijit/Dialog",
    "dijit/TooltipDialog",
    "dijit/ProgressBar",

    "arc/common",

    "gridx/modules/Filter",

    "gridx/modules/Header",
    "gridx/modules/Bar",
    "gridx/support/Summary",
    "gridx/modules/VirtualVScroller",
    "gridx/modules/CellWidget",
    "gridx/modules/extendedSelect/Row",
    "gridx/modules/IndirectSelectColumn",
    "gridx/modules/Edit",
    "gridx/core/model/extensions/Modify",
    "gridx/modules/ColumnLock",
    "gridx/modules/ColumnResizer",
    "gridx/modules/SingleSort",
    "gridx/modules/Pagination",
    "gridx/modules/pagination/PaginationBar",

    "dojo/domReady!"
    
], function(xhr, ioQuery, dom, domStyle, registry, domConstruct, on, domAttr, keys, domForm, declare, _WidgetBase, popup, when, lang, dojoCache, Memory, JsonRest, Cache, Grid, TabContainer, BorderContainer, ContentPane, Button, TextBox, NumberTextBox, FilteringSelect, DateTextBox, Textarea, CheckBox, DropDownButton, ValidationTextBox, NumberSpinner, Dialog, TooltipDialog, ProgressBar, common, Filter ){

    const arc = {};

    ////
    // Selection
    ////

    const main_uri      = domAttr.get(dom.byId("main_uri"),"value");
    const static_uri    = domAttr.get(dom.byId("static_uri"),"value");
    const session_user  = domAttr.get(dom.byId("session_user"),"value");
    const program_title = domAttr.get(dom.byId("program_title"),"value");

    ////
    // Stores
    ////

    // Memory - for cache
    
    const cache_store_data = [{}];
    const cache_store = new Memory({data: cache_store_data});

    // Memory - Status

    status_store = new Memory({
        data: [
            { id:"1", name:"Active"   },   
            { id:"2", name:"Inactive" }
        ]    
    });

    // Memory - Groups 

    privilege_store = new Memory({
        data: [
            { id:"1", name:"Administrator"   },   
            { id:"2", name:"PowerUser" },
            { id:"3", name:"Read-Only User" }
        ]    
    });
    
    // JsonRest

    const user_manager_store = JsonRest({target:main_uri+"/user_manager/"});
    const memory_store_98    = new Memory();
    user_manager_store_cache = new dojoCache(user_manager_store,memory_store_98);   

    const department_store_select = JsonRest({target:main_uri+"/filtering_select/department/"});
    const memory_store_99         = new Memory();
    department_store_select_cache = new dojoCache(department_store_select,memory_store_99);   

    ////
    // Layout
    ////

    arc.site_layout = new function(){

        const header_logo  = static_uri+"images/group.png";
        const header_title = program_title;

        const header_home_link = {
            id:"header_home",
            innerHTML:"Home",
            "class":"headerLink",
            style:{cursor:"pointer",padding:"0 6px 0 6px",borderLeft:"1px dotted silver"},
            click: function(evt){
                setTimeout(window.location = main_uri+'/',3000);
            }
        };

        const header_add_link = {
            id:"header_add",
            innerHTML:"Add Entry",
            "class":"headerLink",
            style:{cursor:"pointer",padding:"0 6px 0 6px",borderLeft:"1px dotted silver"},
            click: function(evt){

                if(!registry.byId('dialog_add_form_username')){

                    createAddDialog(); 
                    clearAddForm();

                    registry.byId('dialog_add').show();
                }
                else{

                    clearAddForm();
                    registry.byId('dialog_add').show();
                }
            }
        };

        const header_refresh_link = {
            id:"header_refresh",
            innerHTML:"Refresh",
            "class":"headerLink",
            style:{cursor:"pointer",padding:"0 6px 0 6px",borderLeft:"1px dotted silver"},
            click: function(evt){
                cache_store.remove("filter");
                setGridFilter('gridx_Grid_0',{});
            }
        };

        const header_admin_link = {
            id:"header_admin",
            innerHTML:"Settings",
            "class":"headerLink",
            style:{cursor:"pointer",padding:"0 6px 0 0"},
            click: function(evt){

                if(!registry.byId('dialog_admin_add_textbox_department')){
                    createAdminDialog(); 
                    registry.byId('dialog_admin').show();
                }
                else{
                   registry.byId('dialog_admin').show();
                }
            }
        };

        const header_filter_link = {
            id:"header_filter",
            innerHTML:"Advanced Filter",
            "class":"headerLink",
            style:{cursor:"pointer",padding:"0 6px 0 6px",borderLeft:"1px dotted silver",marginRight:"5px"},
            click: function(evt){

                // Show Dialog

                if(!registry.byId('dialog_filter_form_object_username')){
                    createFilterDialog(); 
                    registry.byId('dialog_filter').show();
                }
                else{
                   registry.byId('dialog_filter').show();
                }

            }
        };

        const header_search_textbox = new TextBox({
            id: "header_search_textbox",
            name: "header_search_textbox",
            value: "",
            placeHolder: "Search Entries",
            style:"width:220px;",
            intermediateChanges: true
        });

        const header_search_button  = new Button({
            id: "header_search_button",
            label: '<img style="width:14px;height:14px" src="'+static_uri+'images/find.png" title="Search for Services">',
            "class": "tooltipLink"
        });

        registry.byId("header_search_textbox").lastValue = '';
        var filter_textbox_timeout;

        on(registry.byId("header_search_textbox"), "change", function(evt){

            const value = this.get("value");
            const key   = evt.keyCode;

            if(value != this.lastValue) {

                this.lastValue = value;

                if(filter_textbox_timeout) { clearTimeout(filter_textbox_timeout); }
                
                filter_textbox_timeout = setTimeout(function() {

                    if(value == ''){
                        setGridFilter('gridx_Grid_0',{});
                        cache_store.remove("filter");
                        registry.byId("header_search_button").set("label",'<img style="width:14px;height:14px" src="'+static_uri+'images/find.png" title="Filter the Service table">');
                    }
                    else{
                        registry.byId('gridx_Grid_0').filter.setFilter(
                            Filter.contain(
                                Filter.column('search'), 
                                Filter.value(value)
                            )
                        );
                        cache_store.put({ id:"filter", query: value });

                        registry.byId("header_search_button").set("label",'<img style="width:14px;height:14px" src="'+static_uri+'images/delete.png" title="Clear the Service table filter">');
                        on(registry.byId("header_search_button"), "click", function(){
                            registry.byId("header_search_button").set("label",'<img style="width:14px;height:14px" src="'+static_uri+'images/find.png" title="Filter the Service table">');
                            registry.byId("header_search_textbox").set("value",null);
                        });
                    }
                }, key == keys.ENTER ? 0 : 700);
            }
        });

        const header_logout_link = {
            id:"header_logout_link",
            innerHTML:"Logout",
            "class":"headerLink",
            style:{ cursor: "pointer",marginRight:"5px" },
            click: function(evt){
                window.location = main_uri+"/logout";
            }
        };

        const border_container = new BorderContainer({gutters:false,style:"padding: 0;width:890px;height:500px;margin-left:auto;margin-right:auto;margin-top:80px"});

        // Top Pane
        const top_pane = new ContentPane({region:"top",style:"background-color: #F8F8F8;height:39px;padding:0;border-top: 1px solid silver;border-left: 1px solid silver;border-right: 1px solid silver;border-top-right-radius: 10px;border-top-left-radius: 10px;"}).placeAt(border_container);

        const tp = new Object();

        tp["0"]  = domConstruct.create('table', {border:"0",style:{width:"100%",height:"100%",whiteSpace:"nowrap"}},top_pane.containerNode);
        tp["1"]  = domConstruct.create('tbody', {},tp["0"]);

        tp["2"]  = domConstruct.create('tr', {},tp["1"]);
        tp["3"]  = domConstruct.create('td', {style:{width:"20px",height:"5px",paddingRight:"2px",paddingLeft:"2px"}},tp["2"]);
        domConstruct.create('img', {src:header_logo,alt:"Active",style:{verticalAlign:"middle"}},tp["3"]);

        tp["4"]  = domConstruct.create('td', {style:{width:"110px",fontSize:"14px",fontWeight:"bold",verticalAlign:"middle"}},tp["2"]);
        domConstruct.create('span', {style:{paddingLeft:"6px",borderLeft:"1px dotted silver"},innerHTML:header_title},tp["4"]);

        tp["5"]  = domConstruct.create('td', {style:{width:"200px",verticalAlign:"middle"}},tp["2"]);
        domConstruct.create('span',header_add_link,tp["5"]);

        tp["6"] = domConstruct.create('td', {style:{textAlign:"right",verticalAlign:"middle"}},tp["2"]);
        domConstruct.create('span',header_admin_link,tp["6"]);
        domConstruct.create('span',header_filter_link,tp["6"]);
        header_search_textbox.placeAt(tp["6"]);
        domConstruct.create('span', {innerHTML:"&nbsp;&nbsp;"},tp["6"]);
        header_search_button.placeAt(tp["6"]);
        domConstruct.create('span', {style:{marginLeft:"8px",padding:"0 0 0 8px",borderLeft:"1px dotted silver"},innerHTML:"Hello: <strong>"+session_user+"</strong>&nbsp;&bull;&nbsp;"},tp["6"]);
        domConstruct.create('span', header_logout_link,tp["6"]);

        // Center Pane
        const center_pane = new ContentPane({id:"main_container",region:"center",splitter:false,style:"padding:5px;border:1px solid silver;border-bottom-right-radius: 10px;border-bottom-left-radius: 10px;"}).placeAt(border_container);

        return border_container;
    }

    arc.site_layout.placeAt(document.body);
    arc.site_layout.startup();

    createServiceTab({store:user_manager_store_cache,query:{}});

    new Dialog({ id:'dialog_add',    title: "New Entry" });
    new Dialog({ id:'dialog_admin',  title: "Settings" });
    new Dialog({ id:'dialog_filter', title: "Advanced Filter" });

    function createDialog(fn_object){
        const myDialog = new Dialog({
            id:fn_object.rid,
            title: fn_object.title
        });
        return myDialog;
    }

    ///////////////////////////////////////////////////////////////////////////
    
    ////
    // Dialogs
    ////
   
    function createAddDialog(){

        dijit.byId("dialog_add").onShow = function(){
        };

        // username
        new TextBox({ id:   "dialog_add_form_username", 
                      name: "dialog_add_form_username", placeHolder: "Add Username" });

        // real name
        new TextBox({ id:   "dialog_add_form_real_name", 
                      name: "dialog_add_form_real_name", placeHolder: "Add Real Name" });

        // department
        new FilteringSelect({ 
            id: "dialog_add_form_department", 
            name: "dialog_add_form_department", 
            value: "", 
            required: false, 
            placeHolder: "Select Department",
            store:department_store_select_cache 
        });

        // password
        new TextBox({ id:   "dialog_add_form_password", 
                      name: "dialog_add_form_password", 
                      type: "password",
                      placeHolder: "Add Password" });

        // confirm password
        new TextBox({ id:   "dialog_add_form_confirm_password", 
                      name: "dialog_add_form_confirm_password", 
                      type: "password",
                      placeHolder: "Confirm Password" });

        // Submit 
        const dialog_add_button1 = new Button({
            id: "dialog_add_button1",
            label: "Submit",
            onClick: function(){
                
                domStyle.set(registry.byId("dialog_add_progress").domNode, "display", "block");
                registry.byId("dialog_add_progress").set({indeterminate: true, maximum: 100, label: 'Loading...'});
                
                // Create a form to handle Grid Data
                const form = document.createElement("form");
                form.setAttribute("id", "form_name");
                form.setAttribute("name", "form_name");
                dojo.body().appendChild(form);
                    
                const element_object = new Object();

                element_object["username"] = document.createElement("input");
                element_object["username"].setAttribute("type", "hidden");
                element_object["username"].setAttribute("name", "username");
                element_object["username"].setAttribute("value", registry.byId("dialog_add_form_username").get("value") );
                form.appendChild(element_object["username"]);

                element_object["real_name"] = document.createElement("input");
                element_object["real_name"].setAttribute("type", "hidden");
                element_object["real_name"].setAttribute("name", "real_name");
                element_object["real_name"].setAttribute("value", registry.byId("dialog_add_form_real_name").get("value") );
                form.appendChild(element_object["real_name"]);

                element_object["department"] = document.createElement("input");
                element_object["department"].setAttribute("type", "hidden");
                element_object["department"].setAttribute("name", "department");
                element_object["department"].setAttribute("value", registry.byId("dialog_add_form_department").get("value") );
                form.appendChild(element_object["department"]);

                const password         = registry.byId("dialog_add_form_password").get("value");
                const confirm_password = registry.byId("dialog_add_form_confirm_password").get("value");

                if(password){

                    if (password != confirm_password){ 
                        // Remove Form
                        dojo.body().removeChild(form);

                        alert("New Password and Confirm New Password do not match");

                        registry.byId("dialog_add_progress").set({indeterminate: false, maximum: 100, label: "",value: ""});
                        domStyle.set(registry.byId("dialog_add_progress").domNode, "display", "none");
                        return false;
                    }

                    element_object["password"] = document.createElement("input");
                    element_object["password"].setAttribute("type", "hidden");
                    element_object["password"].setAttribute("name", "password");
                    element_object["password"].setAttribute("value", registry.byId("dialog_add_form_password").get("value") );
                    form.appendChild(element_object["password"]);

                    element_object["confirm_password"] = document.createElement("input");
                    element_object["confirm_password"].setAttribute("type", "hidden");
                    element_object["confirm_password"].setAttribute("name", "confirm_password");
                    element_object["confirm_password"].setAttribute("value", registry.byId("dialog_add_form_confirm_password").get("value") );
                    form.appendChild(element_object["confirm_password"]);
                }

                const role_array = new Array();
                const role_children_array = role_grid.model.children();
                for (var i = 0; i < role_children_array.length; i++) {
                    var status = role_grid.model.byId(role_children_array[i]).data[1];
                    var group  = role_grid.model.byId(role_children_array[i]).data[2];
                    var role   = role_grid.model.byId(role_children_array[i]).data[3];
                    if(status == true){
                        status = 1; 
                    }
                    else{
                        status = 2;
                    }
                    role_array.push({status:status,group:group,role:role});
                }

                element_object["role"] = document.createElement("input");
                element_object["role"].setAttribute("type", "hidden");
                element_object["role"].setAttribute("name", "role");
                element_object["role"].setAttribute("value", dojo.toJson(role_array) );
                form.appendChild(element_object["role"]);

                xhr.post(main_uri+"/add", {
                    data: domForm.toObject("form_name"),
                    handleAs: "text"
                }).then(function(response){
                    
                    setGridFilter('gridx_Grid_0',{});
                    cache_store.remove("filter");

                    // Remove Form
                    dojo.body().removeChild(form);

                    const match_error = response.match(/^Error/g);

                    if(!match_error){
                        setTimeout(function(){
                            registry.byId('dialog_add').hide();
                        },2000);
                    }
                    
                    //Stop ProgressBar
                    registry.byId("dialog_add_progress").set({indeterminate: false, label: response, value: 100});

                }, function(error){
                    console.log("An error occurred: " + error);
                    return error;
                });
            }
        });

        const dialog_add_button2 = new Button({
            id: "dialog_add_button2",
            label: "Clear",
            onClick: function(){
                clearAddForm();
                role_grid.model.clearLazyData();
            }
        });

        const dialog_add_progress = new ProgressBar({
            id: "dialog_add_progress",
            style:"width:100%;", 
            value: ""
        });

        ////
        // Display
        ////

        const content_pane = new ContentPane({style:"width:390px"});

        const cp_object = new Object();

        cp_object["0"] = domConstruct.create('table', {border:"0",style:{width:"100%"}},content_pane.containerNode);
        cp_object["1"] = domConstruct.create('tbody', {},cp_object["0"]);
        cp_object["2"] = domConstruct.create('tr', {},cp_object["1"]);
        cp_object["3"] = domConstruct.create('td', {colSpan:'2',style:{paddingBottom:"15px"}},cp_object["2"]);
        domConstruct.create('span', {innerHTML:"Complete the following to create a new entry"},cp_object["3"]);

        const required_object = new Object();

        required_object["username_1"] = domConstruct.create('tr', {},cp_object["1"]);
        required_object["username_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["username_1"]);
        domConstruct.create('span', {innerHTML:"Username:"},required_object["username_2"]);
        required_object["username_3"] = domConstruct.create('td', {style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["username_1"]);
        registry.byId("dialog_add_form_username").placeAt(required_object["username_3"]);

        cp_object["4"] = domConstruct.create('tr', {},cp_object["1"]);
        cp_object["5"] = domConstruct.create('td', {colSpan:'2',style:{textAlign:"center",padding:"5px 0 5px 0"}},cp_object["4"]);
        domConstruct.create('hr', {"class":"style-six"},cp_object["5"]);

        required_object["real_name_1"] = domConstruct.create('tr', {},cp_object["1"]);
        required_object["real_name_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["real_name_1"]);
        domConstruct.create('span', {innerHTML:"Real Name:"},required_object["real_name_2"]);
        required_object["real_name_3"] = domConstruct.create('td', {style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["real_name_1"]);
        registry.byId("dialog_add_form_real_name").placeAt(required_object["real_name_3"]);

        required_object["department_1"] = domConstruct.create('tr', {},cp_object["1"]);
        required_object["department_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["department_1"]);
        domConstruct.create('span', {innerHTML:"Department:"},required_object["department_2"]);
        required_object["department_3"] = domConstruct.create('td', {style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["department_1"]);
        registry.byId("dialog_add_form_department").placeAt(required_object["department_3"]);

        cp_object["6"] = domConstruct.create('tr', {},cp_object["1"]);
        cp_object["7"] = domConstruct.create('td', {colSpan:'2',style:{textAlign:"center",padding:"5px 0 5px 0"}},cp_object["6"]);
        domConstruct.create('hr', {"class":"style-six"},cp_object["7"]);

        required_object["password_1"] = domConstruct.create('tr', {},cp_object["1"]);
        required_object["password_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["password_1"]);
        domConstruct.create('span', {innerHTML:"Password:"},required_object["password_2"]);
        required_object["password_3"] = domConstruct.create('td', {style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["password_1"]);
        registry.byId("dialog_add_form_password").placeAt(required_object["password_3"]);

        required_object["confirm_password_1"] = domConstruct.create('tr', {},cp_object["1"]);
        required_object["confirm_password_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["confirm_password_1"]);
        domConstruct.create('span', {innerHTML:"Confirm Password:"},required_object["confirm_password_2"]);
        required_object["confirm_password_3"] = domConstruct.create('td', {style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["confirm_password_1"]);
        registry.byId("dialog_add_form_confirm_password").placeAt(required_object["confirm_password_3"]);

        cp_object["8"] = domConstruct.create('tr', {},cp_object["1"]);
        cp_object["9"] = domConstruct.create('td', {colSpan:'2',style:{textAlign:"center",padding:"5px 0 5px 0"}},cp_object["8"]);
        domConstruct.create('hr', {"class":"style-six"},cp_object["9"]);

        cp_object["10"] = new ContentPane({style:"padding:0;border:0;height:130px"}).placeAt(content_pane);

        const role_grid_layout = [
            {name:"Status", field:"status", style: "text-align:center;", editable: true,alwaysEditing: true,
                editor: "dijit.form.CheckBox",
                editorArgs: {
                    props: 'value: true'
                }
            },
            {name:"Application", field:"group", style: "text-align:center;"},
            {
                name:"Role", field:"privilege", style: "text-align:center;", editable: true,
                alwaysEditing: true,
                editor: FilteringSelect,
                editorArgs: {
                    props: 'store: privilege_store'
                }
            }
        ];

        const role_grid = new Grid({ 
            cacheClass: Cache,
            style:"width:100%;height:100%",
            store: JsonRest({target:main_uri+"/role_manager/"}),
            structure: role_grid_layout,
            selectRowTriggerOnCell: true,
            columnWidthAutoResize: true,
            modules: [
                "gridx/modules/VirtualVScroller",
                "gridx/modules/CellWidget",
                "gridx/modules/Edit",
                "gridx/modules/SingleSort"
            ],
            editLazySave: true
        }).placeAt(cp_object["10"]);

        // refresh grid
        dijit.byId("dialog_add").onShow = function(){
            setGridFilter(role_grid.id,{});
        };

        // clear grid edits
        dijit.byId("dialog_add").onHide = function(){
            role_grid.model.clearLazyData();
        };

        const bottom_pane = new ContentPane({style:"padding:0;border:0;height:65px"}).placeAt(content_pane);

        const bp_object = new Object();

        bp_object["0"] = domConstruct.create('table', {border:"0",style:{width:"100%"}},bottom_pane.containerNode);
        bp_object["1"] = domConstruct.create('tbody', {},bp_object["0"]);

        bp_object["2"] = domConstruct.create('tr', {},bp_object["1"]);
        bp_object["3"] = domConstruct.create('td', {colSpan:'2',style:{padding:"5px 0 5px 0",textAlign:"center"}},bp_object["2"]);
        dialog_add_button1.placeAt(bp_object["3"]);
        dialog_add_button2.placeAt(bp_object["3"]);
        bp_object["4"] = domConstruct.create('tr', {},bp_object["1"]);
        bp_object["5"] = domConstruct.create('td', {colSpan:'2',style:{textAlign:"center"}},bp_object["4"]);
        dialog_add_progress.placeAt(bp_object["5"]);

        registry.byId("dialog_add").set("content",content_pane);
    }

    function clearAddForm(){

        registry.byId("dialog_add_progress").set({indeterminate: false, maximum: 100, label: "",value: ""});
        domStyle.set(registry.byId("dialog_add_progress").domNode, "display", "none");

        registry.byId("dialog_add_form_username").set("value",null);
        registry.byId("dialog_add_form_real_name").set("value",null);
        registry.byId("dialog_add_form_department").set("displayedValue",null);
        registry.byId("dialog_add_form_password").set("value",null);
        registry.byId("dialog_add_form_confirm_password").set("value",null);

        registry.byId('dialog_add').show();
    }

    function createModifyDialog(fn_object){

        const username = fn_object.cell_data.rawData["username"];

        // username
        new TextBox({ id:   "dialog_modify_form_"+fn_object.rid+"_username", 
                      name: "dialog_modify_form_"+fn_object.rid+"_username", placeHolder: "Add Username" });

        // real name
        new TextBox({ id:   "dialog_modify_form_"+fn_object.rid+"_real_name", 
                      name: "dialog_modify_form_"+fn_object.rid+"_real_name", placeHolder: "Add Real Name" });

        new FilteringSelect({ 
            id: "dialog_modify_form_"+fn_object.rid+"_status", 
            name: "dialog_modify_form_"+fn_object.rid+"_status", 
            value: "", 
            required: false, 
            placeHolder: "Select Status",
            store: status_store
        });

        new FilteringSelect({ 
            id: "dialog_modify_form_"+fn_object.rid+"_department", 
            name: "dialog_modify_form_"+fn_object.rid+"_department", 
            value: "", 
            required: false, 
            placeHolder: "Select Department",
            store: department_store_select_cache
        });

        // password
        new TextBox({ id:   "dialog_modify_form_"+fn_object.rid+"_new_password", 
                      name: "dialog_modify_form_"+fn_object.rid+"_new_password", 
                      type: "password",
                      placeHolder: "Add New Password" });

        // confirm password
        new TextBox({ id:   "dialog_modify_form_"+fn_object.rid+"_confirm_new_password", 
                      name: "dialog_modify_form_"+fn_object.rid+"_confirm_new_password", 
                      type: "password",
                      placeHolder: "Confirm New Password" });

        const dialog_modify_button = new Button({
            id: "dialog_modify_button_"+fn_object.rid,
            label: "Update",
            onClick: function(){

                var hide_dialog = null;
                
                domStyle.set(registry.byId("dialog_modify_progress_"+fn_object.rid).domNode, "display", "block");
                registry.byId("dialog_modify_progress_"+fn_object.rid).set({indeterminate: true, maximum: 100, label: 'Loading...'});

                const current_grid = registry.byId('gridx_Grid_0');

                // username

                const form_object_username = { "username": registry.byId("dialog_modify_form_"+fn_object.rid+"_username").get("value")};

                if(registry.byId("dialog_modify_form_"+fn_object.rid+"_username").get("value")){
                    current_grid.model.set(fn_object.rid,form_object_username);
                }

                // real name

                const form_object_real_name = { "real_name": registry.byId("dialog_modify_form_"+fn_object.rid+"_real_name").get("value")};

                if(registry.byId("dialog_modify_form_"+fn_object.rid+"_real_name").get("value")){
                    current_grid.model.set(fn_object.rid,form_object_real_name);
                }

                // status
                const form_object_status = { "status": registry.byId("dialog_modify_form_"+fn_object.rid+"_status").get("displayedValue") ,
                                             "status_id": registry.byId("dialog_modify_form_"+fn_object.rid+"_status").get("value")};

                if(registry.byId("dialog_modify_form_"+fn_object.rid+"_status").get("value")){
                    current_grid.model.set(fn_object.rid,form_object_status);
                }

                // department 

                const form_object_department = { "department": registry.byId("dialog_modify_form_"+fn_object.rid+"_department").get("displayedValue") ,
                                                 "department_id": registry.byId("dialog_modify_form_"+fn_object.rid+"_department").get("value")};

                if(registry.byId("dialog_modify_form_"+fn_object.rid+"_department").get("value")){
                    current_grid.model.set(fn_object.rid,form_object_department);
                }

                const check_if_dirty = current_grid.model.getChanged();

                if(check_if_dirty.length > 0){
                    current_grid.model.save();
                    hide_dialog = 1;
                }

                const new_password         = registry.byId("dialog_modify_form_"+fn_object.rid+"_new_password").get("value");
                const confirm_new_password = registry.byId("dialog_modify_form_"+fn_object.rid+"_confirm_new_password").get("value");

                if(new_password){

                    // Create a form to handle Grid Data
                    const form = document.createElement("form");
                    form.setAttribute("id", "change_password_form");
                    form.setAttribute("name", "change_password_form");
                    dojo.body().appendChild(form);
                        
                    const rid_element = document.createElement("input");
                    rid_element.setAttribute("type", "hidden");
                    rid_element.setAttribute("name", "rid");
                    rid_element.setAttribute("value", fn_object.rid);
                    form.appendChild(rid_element);

                    if (new_password != confirm_new_password){ 
                        // Remove Form
                        dojo.body().removeChild(form);

                        registry.byId("dialog_modify_progress_"+fn_object.rid).set({indeterminate: false, maximum: 100, label: "",value: ""});
                        domStyle.set(registry.byId("dialog_modify_progress_"+fn_object.rid).domNode, "display", "none");   

                        alert("New Password and Confirm New Password do not match");
                        return false;
                    }

                    const new_password_element = document.createElement("input");
                    new_password_element.setAttribute("type", "hidden");
                    new_password_element.setAttribute("name", "new_password");
                    new_password_element.setAttribute("value", new_password);
                    form.appendChild(new_password_element);

                    const confirm_new_password_element = document.createElement("input");
                    confirm_new_password_element.setAttribute("type", "hidden");
                    confirm_new_password_element.setAttribute("name", "confirm_new_password");
                    confirm_new_password_element.setAttribute("value", confirm_new_password);
                    form.appendChild(confirm_new_password_element);

                    xhr.post(main_uri+"/modify_password", {
                        data: domForm.toObject("change_password_form"),
                        handleAs: "text"
                    }).then(function(response){

                        setGridFilter('gridx_Grid_0',{});
                        cache_store.remove("filter");

                        // Remove Form
                        dojo.body().removeChild(form);
                        
                        hide_dialog = 1;

                    }, function(error){
                        console.log("An error occurred: " + error);
                        return error;
                    });
                }

                // Role Grid - Save
                const check_if_dirty_role = role_grid.model.getChanged();
                if(check_if_dirty_role.length > 0){
                    for	(var index = 0; index < check_if_dirty_role.length; index++) {
                        role_grid.model.save();
                    } 
                    hide_dialog = 1;
                }

                if(hide_dialog){

                    setTimeout(function(){
                        registry.byId("dialog_modify_progress_"+fn_object.rid).set({indeterminate: false, label: "Modified entry successfully!", value: 100});
                    },500);

                    setTimeout(function(){
                        registry.byId('dialog_modify_'+fn_object.rid).hide();
                    },2000);
                }
            }
        });

        const dialog_modify_progress = new ProgressBar({
            id: "dialog_modify_progress_"+fn_object.rid,
            style:"width:100%;", 
            value: ""
        });

        ////
        // Display
        ////

        const border_container = new BorderContainer({gutters:false,style:"width:390px;height:475px"});

        const left_pane = new ContentPane({region:"left"}).placeAt(border_container);

        const lp_object = new Object();

        lp_object["0"] = domConstruct.create('table', {border:"0",style:{width:"100%"}},left_pane.containerNode);
        lp_object["1"] = domConstruct.create('tbody', {},lp_object["0"]);
        lp_object["2"] = domConstruct.create('tr', {},lp_object["1"]);
        lp_object["3"] = domConstruct.create('td', {colSpan:'2',style:{padding:"10px"}},lp_object["2"]);
        lp_object["4"] = domConstruct.create('span', {innerHTML:"Complete the following to MODIFY the selected user: <strong>"+username+"</strong>"},lp_object["3"]);

        const required_object = new Object();

        // username
        required_object["username_1"] = domConstruct.create('tr', {},lp_object["1"]);
        required_object["username_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["username_1"]);
        domConstruct.create('span', {innerHTML:"Username:"},required_object["username_2"]);
        required_object["username_3"] = domConstruct.create('td', {style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["username_1"]);
        registry.byId("dialog_modify_form_"+fn_object.rid+"_username").placeAt(required_object["username_3"]);

        // real name
        required_object["real_name_1"] = domConstruct.create('tr', {},lp_object["1"]);
        required_object["real_name_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["real_name_1"]);
        domConstruct.create('span', {innerHTML:"Real Name:"},required_object["real_name_2"]);
        required_object["real_name_3"] = domConstruct.create('td', {style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["real_name_1"]);
        registry.byId("dialog_modify_form_"+fn_object.rid+"_real_name").placeAt(required_object["real_name_3"]);

        // status
        required_object["status_1"] = domConstruct.create('tr', {},lp_object["1"]);
        required_object["status_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["status_1"]);
        domConstruct.create('span', {innerHTML:"Status:"},required_object["status_2"]);
        required_object["status_3"] = domConstruct.create('td', {style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["status_1"]);
        registry.byId("dialog_modify_form_"+fn_object.rid+"_status").placeAt(required_object["status_3"]);

        // department
        required_object["department_1"] = domConstruct.create('tr', {},lp_object["1"]);
        required_object["department_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["department_1"]);
        domConstruct.create('span', {innerHTML:"Department:"},required_object["department_2"]);
        required_object["department_3"] = domConstruct.create('td', {style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["department_1"]);
        registry.byId("dialog_modify_form_"+fn_object.rid+"_department").placeAt(required_object["department_3"]);

        lp_object["5"] = domConstruct.create('tr', {},lp_object["1"]);
        lp_object["6"] = domConstruct.create('td', {colSpan:'2',style:{textAlign:"center",padding:"5px 0 5px 0"}},lp_object["5"]);
        domConstruct.create('hr', {"class":"style-six"},lp_object["6"]);

        // password
        required_object["new_password_1"] = domConstruct.create('tr', {},lp_object["1"]);
        required_object["new_password_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["new_password_1"]);
        domConstruct.create('span', {innerHTML:"New Password:"},required_object["new_password_2"]);
        required_object["new_password_3"] = domConstruct.create('td', {style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["new_password_1"]);
        registry.byId("dialog_modify_form_"+fn_object.rid+"_new_password").placeAt(required_object["new_password_3"]);

        // confirm password
        required_object["confirm_new_password_1"] = domConstruct.create('tr', {},lp_object["1"]);
        required_object["confirm_new_password_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["confirm_new_password_1"]);
        domConstruct.create('span', {innerHTML:"Confirm New Password:"},required_object["confirm_new_password_2"]);
        required_object["confirm_new_password_3"] = domConstruct.create('td', {style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["confirm_new_password_1"]);
        registry.byId("dialog_modify_form_"+fn_object.rid+"_confirm_new_password").placeAt(required_object["confirm_new_password_3"]);

        lp_object["7"] = domConstruct.create('tr', {},lp_object["1"]);
        lp_object["8"] = domConstruct.create('td', {colSpan:'2',style:{textAlign:"center",padding:"5px 0  5px 0"}},lp_object["7"]);
        domConstruct.create('hr', {"class":"style-six"},lp_object["8"]);

        // Role

        lp_object["9"] = new ContentPane({region:"center",splitter:false,style:"padding:0;border:0;height:135px"}).placeAt(left_pane);

        const role_grid_layout = [
            {name:"Status", field:"status", width: "55px", style: "text-align:center;", editable: true,alwaysEditing: true,
                editor: "dijit.form.CheckBox",
                editorArgs: {
                    props: 'value: true'
                }
            },
            {name:"Application", field:"group", width: "125px", style: "text-align:center;"},
            {
                name:"Role", field:"privilege", style: "text-align:center;", editable: true,
                alwaysEditing: true,
                editor: FilteringSelect,
                editorArgs: {
                    props: 'store: privilege_store',
                    fromEditor: function(valueInEditor, cell){
                        var obj = privilege_store.get(valueInEditor);
                        return obj.name;
                    },
                    toEditor: function(storeData, gridData, cell, editor){
                        var obj = privilege_store.query({name:storeData});
                        return obj[0].id;
                    }
                }
            }
        ];

        const role_grid = new Grid({ 
            cacheClass: Cache,
            style:"width:100%;height:100%",
            store: JsonRest({target:main_uri+"/role_manager/"+fn_object.rid}),
            structure: role_grid_layout,
            selectRowTriggerOnCell: true,
            columnWidthAutoResize: true,
            modules: [
                "gridx/modules/VirtualVScroller",
                "gridx/modules/CellWidget",
                "gridx/modules/Edit",
                "gridx/modules/SingleSort"
            ],
            editLazySave: true
        }).placeAt(lp_object["9"]);

        // refresh grid
        dijit.byId("dialog_modify_"+fn_object.rid).onShow = function(){
            setGridFilter(role_grid.id,{});
        };

        const bottom_pane = new ContentPane({region:"bottom",style:"height:55px;padding:5px;"}).placeAt(border_container);

        const bp_object = new Object();

        bp_object["0"] = domConstruct.create('table', {border:"0",style:{width:"100%"}},bottom_pane.containerNode);
        bp_object["1"] = domConstruct.create('tbody', {},bp_object["0"]);

        bp_object["2"]  = domConstruct.create('tr', {},bp_object["1"]);
        bp_object["3"]  = domConstruct.create('td', {style:{textAlign:"center"}},bp_object["2"]);
        dialog_modify_button.placeAt(bp_object["3"]);
        bp_object["4"]  = domConstruct.create('tr', {},bp_object["1"]);
        bp_object["5"] = domConstruct.create('td', {style:{textAlign:"center"}},bp_object["4"]);
        dialog_modify_progress.placeAt(bp_object["5"]);

        registry.byId("dialog_modify_"+fn_object.rid).set("content",border_container);
    }

    function populateModifyDialog(fn_object){

        const username = fn_object.cell_data.rawData["username"];

        // Show Dialog
        var dialog_modify = registry.byId('dialog_modify_'+fn_object.rid);

        if(!dialog_modify){
            dialog_modify = createDialog({ rid: "dialog_modify_"+fn_object.rid,title: "Modify - <strong>"+username+"</strong>"});
            createModifyDialog(fn_object);
        }

        dialog_modify.show();

        // Progress Bar
        registry.byId("dialog_modify_progress_"+fn_object.rid).set({indeterminate: false, maximum: 100, label: "",value: ""});
        domStyle.set(registry.byId("dialog_modify_progress_"+fn_object.rid).domNode, "display", "none");   

        registry.byId("dialog_modify_form_"+fn_object.rid+"_new_password").set("value",null);
        registry.byId("dialog_modify_form_"+fn_object.rid+"_confirm_new_password").set("value",null);

        registry.byId("dialog_modify_form_"+fn_object.rid+"_username").set("value",fn_object.cell_data.rawData["username"]);
        registry.byId("dialog_modify_form_"+fn_object.rid+"_real_name").set("value",fn_object.cell_data.rawData["real_name"]);
        registry.byId("dialog_modify_form_"+fn_object.rid+"_status").set("displayedValue",fn_object.cell_data.rawData["status"]);
        registry.byId("dialog_modify_form_"+fn_object.rid+"_department").set("displayedValue",fn_object.cell_data.rawData["department"]);
    }

    function createFilterDialog(fn_object){

        // username
        new TextBox({ id:   "dialog_filter_form_object_username", 
                      name: "dialog_filter_form_object_username",
                      placeHolder: "Filter by Username",
                      disabled: true});

        new CheckBox({ 
            id: "dialog_filter_form_object_username_c", 
            name: "dialog_filter_form_object_username_c", 
            onChange: function(b){
                if(b){
                    registry.byId("dialog_filter_form_object_username").set("disabled", false);
                }
                else{
                    registry.byId("dialog_filter_form_object_username").set("disabled", true);
                }
            }
        });

        // real name
        new TextBox({ id:   "dialog_filter_form_object_real_name", 
                      name: "dialog_filter_form_object_real_name", 
                      placeHolder: "Filter by Real Name",
                      disabled: true});

        new CheckBox({ 
            id: "dialog_filter_form_object_real_name_c", 
            name: "dialog_filter_form_object_real_name_c", 
            onChange: function(b){
                if(b){
                    registry.byId("dialog_filter_form_object_real_name").set("disabled", false);
                }
                else{
                    registry.byId("dialog_filter_form_object_real_name").set("disabled", true);
                }
            }
        });

        new FilteringSelect({ 
            id: "dialog_filter_form_object_status", 
            name: "dialog_filter_form_object_status", 
            value: "", 
            required: false, 
            placeHolder: "Filter by Status",
            store: status_store,
            disabled: true
        });

        new CheckBox({ 
            id: "dialog_filter_form_object_status_c", 
            name: "dialog_filter_form_object_status_c", 
            onChange: function(b){
                if(b){
                    registry.byId("dialog_filter_form_object_status").set("disabled", false);
                }
                else{
                    registry.byId("dialog_filter_form_object_status").set("disabled", true);
                }
            }
        });

        new FilteringSelect({ 
            id: "dialog_filter_form_object_department", 
            name: "dialog_filter_form_object_department", 
            value: "", 
            required: false, 
            placeHolder: "Filter by Department",
            store: department_store_select_cache,
            disabled: true
        });

        new CheckBox({ 
            id: "dialog_filter_form_object_department_c", 
            name: "dialog_filter_form_object_department_c", 
            onChange: function(b){
                if(b){
                    registry.byId("dialog_filter_form_object_department").set("disabled", false);
                }
                else{
                    registry.byId("dialog_filter_form_object_department").set("disabled", true);
                }
            }
        });

        const dialog_filter_button1 = new Button({
            id: "dialog_filter_button1",
            label: "Filter",
            onClick: function(){

                const query = {}; 

                if(query["id"]){
                    delete query["id"];
                }

                // username
                if(registry.byId("dialog_filter_form_object_username_c").get("checked") == true){
                    query[ "username" ] = registry.byId("dialog_filter_form_object_username").get("value");
                }
                // real name
                if(registry.byId("dialog_filter_form_object_real_name_c").get("checked") == true){
                    query[ "real_name" ] = registry.byId("dialog_filter_form_object_real_name").get("value");
                }
                // status
                if(registry.byId("dialog_filter_form_object_status_c").get("checked") == true){
                    query[ "status_id" ] = registry.byId("dialog_filter_form_object_status").get("value");
                }

                // department
                if(registry.byId("dialog_filter_form_object_department_c").get("checked") == true){
                    query[ "department_id" ] = registry.byId("dialog_filter_form_object_department").get("value");
                }

                registry.byId('gridx_Grid_0').filter.setFilter( 
                    Filter.contain(
                        Filter.column('advanced_search'),
                        Filter.value(ioQuery.objectToQuery(query))
                    ) 
                );
                cache_store.put({ id:"filter", query: query });
            }
        });

        const dialog_filter_button2 = new Button({
            id: "dialog_filter_button2",
            label: "Clear",
            onClick: function(){

                cache_store.remove("filter");
                setGridFilter('gridx_Grid_0',{});

                registry.byId("dialog_filter_form_object_username_c").set("checked",false);
                registry.byId("dialog_filter_form_object_username").set("value",null);

                registry.byId("dialog_filter_form_object_real_name_c").set("checked",false);
                registry.byId("dialog_filter_form_object_real_name").set("value",null);

                registry.byId("dialog_filter_form_object_status_c").set("checked",false);
                registry.byId("dialog_filter_form_object_status").set("displayedValue",null);

                registry.byId("dialog_filter_form_object_department_c").set("checked",false);
                registry.byId("dialog_filter_form_object_department").set("displayedValue",null);
            }
        });

        ////
        // Display
        ////

        const content_pane = new ContentPane();

        const cp_object = new Object();

        cp_object["0"] = domConstruct.create('table', {border:"0",style:{width:"400px"}},content_pane.containerNode);
        cp_object["1"] = domConstruct.create('tbody', {},cp_object["0"]);
        cp_object["2"] = domConstruct.create('tr', {},cp_object["1"]);
        cp_object["3"] = domConstruct.create('td', {colSpan:'3',style:{padding:"15px"}},cp_object["2"]);
        cp_object["4"] = domConstruct.create('span', {innerHTML:"Complete the following to FILTER the entries"},cp_object["3"]);

        const required_object = new Object();

        // username
        required_object["username_1"] = domConstruct.create('tr', {},cp_object["1"]);
        required_object["username_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px"}},required_object["username_1"]);
        registry.byId("dialog_filter_form_object_username_c").placeAt(required_object["username_2"]);

        required_object["username_3"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["username_1"]);
        domConstruct.create('span', {innerHTML:"Username:"},required_object["username_3"]);

        required_object["username_4"] = domConstruct.create('td', {colSpan:'2',style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["username_1"]);
        registry.byId("dialog_filter_form_object_username").placeAt(required_object["username_4"]);

        // real_name
        required_object["real_name_1"] = domConstruct.create('tr', {},cp_object["1"]);
        required_object["real_name_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px"}},required_object["real_name_1"]);
        registry.byId("dialog_filter_form_object_real_name_c").placeAt(required_object["real_name_2"]);

        required_object["real_name_3"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["real_name_1"]);
        domConstruct.create('span', {innerHTML:"Real Name:"},required_object["real_name_3"]);

        required_object["real_name_4"] = domConstruct.create('td', {colSpan:'2',style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["real_name_1"]);
        registry.byId("dialog_filter_form_object_real_name").placeAt(required_object["real_name_4"]);

        // status
        required_object["status_1"] = domConstruct.create('tr', {},cp_object["1"]);
        required_object["status_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px"}},required_object["status_1"]);
        registry.byId("dialog_filter_form_object_status_c").placeAt(required_object["status_2"]);

        required_object["status_3"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["status_1"]);
        domConstruct.create('span', {innerHTML:"Status:"},required_object["status_3"]);

        required_object["status_4"] = domConstruct.create('td', {colSpan:'2',style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["status_1"]);
        registry.byId("dialog_filter_form_object_status").placeAt(required_object["status_4"]);

        cp_object["5"] = domConstruct.create('tr', {},cp_object["1"]);
        cp_object["6"] = domConstruct.create('td', {colSpan:'3',style:{textAlign:"center"}},cp_object["5"]);
        domConstruct.create('hr', {"class":"style-six"},cp_object["6"]);

        // department
        required_object["department_1"] = domConstruct.create('tr', {},cp_object["1"]);
        required_object["department_2"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px"}},required_object["department_1"]);
        registry.byId("dialog_filter_form_object_department_c").placeAt(required_object["department_2"]);

        required_object["department_3"] = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},required_object["department_1"]);
        domConstruct.create('span', {innerHTML:"Department:"},required_object["department_3"]);

        required_object["department_4"] = domConstruct.create('td', {colSpan:'2',style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},required_object["department_1"]);
        registry.byId("dialog_filter_form_object_department").placeAt(required_object["department_4"]);

        cp_object["7"] = domConstruct.create('tr', {},cp_object["1"]);
        cp_object["8"] = domConstruct.create('td', {colSpan:'3',style:{padding:"10px 0 5px 0",textAlign:"center"}},cp_object["7"]);
        dialog_filter_button1.placeAt(cp_object["8"]);
        dialog_filter_button2.placeAt(cp_object["8"]);

        registry.byId("dialog_filter").set("content",content_pane);
    }

    function createAdminDialog(){

        function createGrid(fn_object){

            const grid_layout = [
                {name:"Status", field:"status", width: "55px", style: "text-align:center;", editable: true,alwaysEditing: true,
                    editor: "dijit.form.CheckBox",
                    editorArgs: {
                        props: 'value: true'
                    }
                },
                {name:"Description", field:"description", width: "auto", style: "text-align:left;", editable: true}
            ];

            const grid = new Grid({ 
                cacheClass: Cache,
                style:"width:100%;height:100%",
                store: fn_object.store,
                structure: grid_layout,
                selectRowTriggerOnCell: true,
                modules: [
                    "gridx/modules/VirtualVScroller",
                    "gridx/modules/CellWidget",
                    "gridx/modules/Edit",
                    "gridx/modules/SingleSort"
                ],
                editLazySave: true
            });

            // Tooltip Dialog
            
            const ttd = new Object();

            ttd["0"] = new TextBox({ 
                id: "dialog_admin_add_textbox_"+fn_object.id, 
                name: "dialog_admin_add_textbox_"+fn_object.id, 
                placeHolder: "Add "+fn_object.name,
                maxlength: 100 
            });

            ttd["2"] = new Button({
                id: "dialog_admin_add_button_"+fn_object.id,
                label: "Submit",
                onClick: function(){

                    // Create a form to handle Grid Data
                    const form = document.createElement("form");
                    form.setAttribute("id", "admin_unprocessed");
                    form.setAttribute("name", "admin_unprocessed");
                    dojo.body().appendChild(form);

                    const element_1 = document.createElement("input");
                    element_1.setAttribute("type", "hidden");
                    element_1.setAttribute("name", "name");
                    element_1.setAttribute("value", fn_object.id);
                    form.appendChild(element_1);

                    const element_2 = document.createElement("input");
                    element_2.setAttribute("type", "hidden");
                    element_2.setAttribute("name", "description");
                    element_2.setAttribute("value", registry.byId("dialog_admin_add_textbox_"+fn_object.id).get("value"));
                    form.appendChild(element_2);

                    const url = "/admin_add";

                    xhr.post(main_uri+url, {
                        data: domForm.toObject("admin_unprocessed"),
                        handleAs: "text"
                    }).then(function(response){
                        
                        setGridFilter(grid.id,{});
                        cache_store.remove("filter");

                        dojo.body().removeChild(form);

                        setTimeout(function(){
                            popup.close(tooltipdialog);
                        },400);

                    }, function(error){
                        console.log("An error occurred: " + error);
                        return error;
                    });
                }
            });

            ttd["3"]  = new ContentPane({});
            ttd["4"]  = domConstruct.create('table', {border:"0",style:{width:"100%",whiteSpace:"nowrap"}},ttd["3"].containerNode);
            ttd["5"]  = domConstruct.create('tbody', {},ttd["4"]);

            ttd["10"]  = domConstruct.create('tr', {},ttd["5"]);
            ttd["11"]  = domConstruct.create('td', {style:{textAlign:"right",padding:"5px",width:"40%"}},ttd["10"]);
            domConstruct.create('span', {innerHTML:"Description:"},ttd["11"]);
            ttd["12"]  = domConstruct.create('td', {style:{textAlign:"left",paddingLeft:"10px",width:"60%"}},ttd["10"]);
            ttd["0"].placeAt(ttd["12"]);

            ttd["13"] = domConstruct.create('tr', {},ttd["5"]);
            ttd["14"] = domConstruct.create('td', {colSpan:'2',style:{textAlign:"center",padding:"5px"}},ttd["13"]);
            ttd["2"].placeAt(ttd["14"]);

            const tooltipdialog = new TooltipDialog({
                content: ttd["3"]
            });

            const dropdown = new DropDownButton({
                label: "Add",
                dropDown: tooltipdialog
            });

            const reload_button = new Button({
                label: "Reload Page!",
                //style: "display: none",
                disabled: true,
                onClick: function(){
                    location.reload(true);
                    domStyle.set(reload_button.domNode, "display", "none");
                    domStyle.set(reload_button.domNode, "border", "");
                }
            });

            const t = new Object();

            t["0"] = new BorderContainer({gutters:true,style:"padding: 0;width:435px;height:380px;"}).placeAt(fn_object.container);

            // Top Pane
            t["1"] = new ContentPane({region:"top",style:"background-color: #F8F8F8;height:32px;padding:0;"}).placeAt(t["0"]);
            t["2"] = domConstruct.create('table', {border:"0",style:{width:"100%",whiteSpace:"nowrap"}},t["1"].containerNode);
            t["3"] = domConstruct.create('tbody', {},t["2"]);
            t["4"] = domConstruct.create('tr', {},t["3"]);
            t["5"] = domConstruct.create('td', {style:{width:"20px",height:"5px",paddingRight:"2px",paddingLeft:"2px"}},t["4"]);
            dropdown.placeAt(t["5"]);

            t["6"] = new ContentPane({region:"center",splitter:false,style:"padding:0;border:0"}).placeAt(t["0"]);

            grid.placeAt(t["6"]);

            grid.edit.connect(grid.edit, "onApply", function(cell, success) {
                const check_if_dirty = grid.model.getChanged();
                if(check_if_dirty.length > 0){
                        console.log("saving table");
                    for	(var index = 0; index < check_if_dirty.length; index++) {
                        grid.model.save();
                    } 
                }
            });
        }

        const tc = new TabContainer({doLayout:true, tabStrip:true, style:"width:435px;height:350px;"});

        // Tab 1
        const t1 = new TabContainer({title:"Selects/Drop-Down",doLayout:true, tabPosition:"left-h", tabStrip:true,style:"padding:5px"}).placeAt(tc);

        const c1 = new ContentPane({title:"Application"}).placeAt(t1);
        createGrid({id:"group_manager",store:JsonRest({target:main_uri+"/admin_grid/group_manager"}),container:c1,name:"Application"});

        const c2 = new ContentPane({title:"Department"}).placeAt(t1);
        createGrid({id:"department",store:JsonRest({target:main_uri+"/admin_grid/department"}),container:c2,name:"Department"});

        registry.byId("dialog_admin").set("content",tc);
    }

    ///////////////////////////////////////////////////////////////////////////

    ////
    // Custom Functions
    //// 
  
    ///////////////////////////////////////////////////////////////////////////

    ////
    // Grids
    ////
   
    function createServiceTab(fn_object) {

        const grid_layout = [
            { name:"--", field:"id", style: "font-size: 8pt;text-align:center;",
                widgetsInCell: true,
                decorator: function(){
                    declare("manage_link", [_WidgetBase], {
                        buildRendering: function(){
                            this.domNode = domConstruct.create("span", {"class": "cellLink",style:{cursor:"pointer",padding:"0 3px 0 3px"},innerHTML: 'Modify'});
                        }
                    });
                    return '<div data-dojo-type="manage_link" data-dojo-attach-point="manage_link_click"></div>';
                },
                getCellWidgetConnects: function(cellWidget, cell){
                    return [
                        [cellWidget.manage_link_click.domNode, 'onclick', function(e){
                            const cell_data = registry.byId(cell.grid.id).model.byId(cell.data());
                            populateModifyDialog({rid: cell.data(), cell_data: cell_data });
                        }]
                    ];
                }
            },
            {name:"Username", field:"username", style: "text-align:center;", editable: true},
            {name:"Real Name", field:"real_name", style: "text-align:center;", editable: true},
            {
                name: "Status", field:"status",style: "text-align:center;", editable: true,
                editor: FilteringSelect,
                editorArgs: {
                    props: 'store: status_store',
                    fromEditor: function(valueInEditor, cell){
                        const obj = status_store.get(valueInEditor);
                        return obj.name;
                    },
                    toEditor: function(storeData, gridData, cell, editor){
                        return 1;
                    }
                }
            },
            {name:"Created", field:"created", style: "text-align:center;"},
            {name:"Updated", field:"updated", style: "text-align:center;"},
            {
                name: "Department", field:"department", style: "text-align:center;", editable: true,
                editor: FilteringSelect,
                editorArgs: {
                    props: 'store: department_store_select_cache',
                    fromEditor: function(valueInEditor, cell){
                        const obj = memory_store_99.get(valueInEditor);
                        return obj.name;
                    },
                    toEditor: function(storeData, gridData, cell, editor){
                        return 1;
                    }
                }
            }
        ];
        
        // Grid
        
        const service_grid  = new Grid({ 
            cacheClass: Cache,
            style:"width:100%;height:99%;;border-bottom-right-radius: 6px;border-bottom-left-radius: 6px;",
            store: fn_object.store,
            structure: grid_layout,
            query: fn_object.query,
            selectRowTriggerOnCell: true,
            paginationBarMessage: "${2} to ${3} of <span style='font-size:11pt'><strong>${0}</strong></span> items",
            filterServerMode: true,
            columnWidthAutoResize: true,
            filterSetupFilterQuery: function(expr){
                if(fn_object.query){
                    const s = lang.clone(fn_object.query);
                    if(expr.data[0].data == 'advanced_search'){
                        return ioQuery.queryToObject(expr.data[1].data);
                    }
                    if(expr.data[0].data == 'search'){
                        s.query = expr.data[1].data;
                        return s;
                    }
                }
            },
            modules: [
                "gridx/modules/Filter",
                "gridx/modules/VirtualVScroller",
                "gridx/modules/CellWidget",
                "gridx/modules/Edit",
                "gridx/modules/SingleSort",
                "gridx/modules/ColumnResizer",
                "gridx/modules/Pagination",
                "gridx/modules/pagination/PaginationBar"
            ],
            editLazySave: true
        });

        service_grid.edit.connect(service_grid.edit, "onApply", function(cell, success) {

            const check_if_dirty = service_grid.model.getChanged();
                            
            if(check_if_dirty.length > 0){
                for	(var index = 0; index < check_if_dirty.length; index++) {
                    service_grid.model.save();
                } 
            }
        });

        const mc = registry.byId("main_container");
        service_grid.placeAt(mc);
    }

    // Filter Clear

    function setGridFilter(grid,obj){
        registry.byId(grid).model.clearCache(); 
        registry.byId(grid).model.query(obj);
        registry.byId(grid).body.refresh();
    }

    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function formatString(string) {
        const result = capitalizeFirstLetter(string);
        if((string).indexOf('_') > -1){
            array1 = (string).split("_");
            array2 = new Array();
            for (index = 0; index < array1.length; index++) {
                array2.push(capitalizeFirstLetter(array1[index]));
            }
            result = array2.join(" ");
        }
        return result;
    }

    function addGridSelectSlice(fn_object){

        const id    = fn_object.id;
        const name  = fn_object.name;
        const nameC = formatString(name);
        const size  = fn_object.size;

        const select_store = new JsonRest({target:main_uri+"/filtering_select/"+id+"/"});
        const memory_store = new Memory();
        select_store_cache = new dojoCache(select_store,memory_store);

        when (select_store_cache.query({name:"*"}),
          function (items, request) {
            //console.log(items);
          }
        );

        const obj = { 
            name: nameC, field:name, width: size, style: "text-align:center;", editable: true,
            editor: FilteringSelect,
            editorArgs: {
                props: 'store: select_store_cache',
                fromEditor: function(valueInEditor, cell){
                    const obj = memory_store.get(valueInEditor);
                    return obj.name;
                },
                toEditor: function(storeData, gridData, cell, editor){
                    editor.set({store: memory_store});
                    return 1;
                }
            }
        };
        return obj;
    }
});
