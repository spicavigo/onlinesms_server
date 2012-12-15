var token;
var page=1;
var total=-1;
var contacts={};
var source = [];

function load() {
    gapi.client.setApiKey('AIzaSyAUuoxYS81W9KvpXJCZX2NjURVMoMCswII');
    gapi.client.load('contacts', 'v3', auth);
}
function auth() {
    var config = {
      'client_id': '762117796319.apps.googleusercontent.com',
      'scope': 'https://www.google.com/m8/feeds'
    };
    gapi.auth.authorize(config, function() {
      console.log('login complete');
      token = gapi.auth.getToken();
      if(! token){
        $('#errormsg').html("Unable to Fetch Contacts from Google").show();
      } else{
        token.alt='json';
        get_contacts();
      }
      
    });
}
function get_contacts(){
    $.ajax({
        url: 'https://www.google.com/m8/feeds/contacts/default/thin',
        dataType: 'jsonp',
        data: token,
        success: function(data) {
            if (total==-1){
                total = parseInt(data.feed['openSearch$totalResults']['$t']);
                token['max-results']=total;
                get_contacts();
                return;
            }
            $.each(data.feed.entry, function(k,value){
                var name = value.title['$t'];
                contacts[name]=[];
                if(value['gd$phoneNumber']){
                    $.each(value['gd$phoneNumber'], function(k,val){
                        contacts[name].push(val['$t']);
                    })
                }
                if(contacts[name].length == 0) delete contacts[name]
                else source.push(name);
            });
            $('#phone').typeahead({
                source: source
            });
        }
    });
}
$(function(){
    $("#sms-form").submit(function(){
        var val = $("#phone").val();
        $("#contact_name").val(val);
        if(source.indexOf(val)>-1) val = contacts[val][0];
        console.log(val);
        if(val.length>0){
            $("#phone").val(val);            
            return true;
        }
        $('#errormsg').html("Invalid Contact Name or Phone Number").show();
        return false;
    })
})
