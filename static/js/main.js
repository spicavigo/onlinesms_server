var token;
var page=1;
var total=-1;
var contacts={};
var source = [];
var params;

function send_to_contact(){
    $('.send-to-contact').show();
    $('.send-to-number').hide();
    $('.nav li').removeClass('active');
    $('.for_contact').addClass('active');
}
function send_to_number(){
    console.log(this);
    $('.send-to-number').show();
    $('.send-to-contact').hide();
    $('.nav li').removeClass('active');
    $('.for_number').addClass('active');
}
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
        $('#page-loader').hide();
        $('#errormsg').html("Unable to Fetch Contacts from Google").show();
      } else{
        params = $.param(token);
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
            console.log(data)
            $.each(data.feed.entry, function(k,value){
                var name = value.title['$t'];
                contacts[name]={
                    'phone':[],
                    'photo':null
                };
                if(value['gd$phoneNumber']){
                    $.each(value['gd$phoneNumber'], function(k,val){
                        contacts[name].phone.push(val['$t']);
                    })
                }
                if(value['link']){
                    $.each(value['link'], function(k,val){
                        
                        if(val.type=='image/*' && val.rel.indexOf('rel#photo')>-1)
                            contacts[name].photo = val.href+'?'+params;
                    })
                }
                if(!contacts[name].photo) contacts[name].photo = '/static/img/profile.png'
                if(contacts[name].phone.length == 0) delete contacts[name]
                else source.push(name);
            });
            $('#phone').typeahead({
                source: source
            });
            var count = 0;
            for(var k in contacts){
                count = count+1;
                $('.iso-container').append('<li class="item" id="_'+count+'"><img src="'+contacts[k].photo+'" class="img-polaroid" width="96" height="96"><span class="name img-caption">'+k+'</span></img></li>');
            }
            init_isotope();
            $('.item').bind('click', function(){
                var name = $(this).find('span').html();
                $('#contact_name2').val(name);
                $('#phone2').val(contacts[name].phone[0])
                $('#sms-modal-label').html("Send SMS to " + name);
                $('#sms-modal .alert').hide();
                $('#sms-modal').modal();
            });
            $('#page-loader').hide();
        }
    });
}
$(function(){
    $("#sms-form").submit(function(e){
        e.preventDefault();
        var val = $("#phone").val();
        $("#contact_name").val(val);
        if(source.indexOf(val)>-1) val = contacts[val][0];
        console.log(val);
        if(val.length>0){
            $("#phone").val(val);
            var data = $(this).serialize();
            $.post('/', data, function(data){
                if(data.status==200){
                    
                } else {
                    $('#errormsg').html("Invalid Contact Name or Phone Number").show();
                }           
            });
            return false;
        }
        $('#errormsg').html("Invalid Contact Name or Phone Number").show();
        return false;
    });
    $("#sms-form-modal").submit(function(e){
        e.preventDefault();
        var data = $(this).serialize();
        $.post('/', data, function(data){
            if(data.status==200){
                $('#sms-modal').modal('hide');
            } else {
                $('#sms-modal .alert').show();
            }           
        });
        return false;
    })
})
